const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { generateRef } = require('../lib/ref')

// Africa's Talking USSD webhook — POST with form-encoded body
// text is the accumulated input, e.g. "" | "1" | "1*CHAI" | "1*CHAI*50*380"
router.post('/', async (req, res) => {
  const sessionId = req.body.sessionId
  const phone = (req.body.phoneNumber || '').trim()
  const text = (req.body.text || '').trim()

  if (!phone) return res.sendStatus(400)

  try {
    const farmer = await getFarmer(phone)

    // ── Registration flow (farmer not yet registered) ──
    if (!farmer) {
      if (text === '') {
        return respond(res, 'CON', 'Karibu MazaoLink!\nWelcome to MazaoLink!\n\nIngiza jina lako kamili:\nEnter your full name:')
      }
      // Any input at this point is their name
      await supabase.from('farmers').insert({ phone, name: text, registered_via: 'ussd' })
      return respond(res, 'END', `✅ Umesajiliwa, ${text}!\nRegistration complete!\n\nPiga tena *384# kuanza.\nDial *384# again to list produce.`)
    }

    // ── Main flow for registered farmers ──
    const parts = text.split('*')
    const step0 = parts[0]
    const step1 = parts[1]
    const step2 = parts[2]
    const step3 = parts[3]

    // Step 0 — main menu
    if (text === '') {
      return respond(res, 'CON',
        `Karibu ${farmer.name}!\n` +
        '1. Orodhesha mazao (List produce)\n' +
        '2. Angalia bei (Check prices)\n' +
        '3. Maagizo yangu (My orders)\n' +
        '4. Mifugo (Cattle)\n' +
        '5. Msaada (Help)'
      )
    }

    // Option 1 — List produce
    if (step0 === '1') {
      if (!step1) return respond(res, 'CON', 'Aina ya zao / Crop type:\n(e.g. CHAI, MAZIWA, MBOGA, VIAZI)')
      if (!step2) return respond(res, 'CON', `Kiasi (${step1.toLowerCase()}):\nQuantity (e.g. 50 for 50kg, 80 for 80L):`)
      if (!step3) return respond(res, 'CON', `Bei kwa kila kiasi (KES):\nPrice per unit in KES (e.g. 380):`)

      const type = step1.toLowerCase()
      const quantity = parseFloat(step2)
      const price = parseFloat(step3)
      const unit = type === 'maziwa' || type === 'milk' ? 'litres' : 'kg'

      if (isNaN(quantity) || isNaN(price)) {
        return respond(res, 'END', 'Kiasi au bei si sahihi. Jaribu tena.\nInvalid quantity or price. Try again.')
      }

      const ref = generateRef('SL')
      await supabase.from('produce').insert({ farmer_id: farmer.id, type, quantity, unit, price_per_unit: price, ref })

      return respond(res, 'END',
        `✅ Imeorodheshwa!\n${capitalize(type)} ${quantity}${unit} @ KES ${price}/${unit}\nRef: ${ref}\n\nMnunuzi atawasiliana nawe.\nA buyer will contact you soon.`
      )
    }

    // Option 2 — Check prices (today's market rates)
    if (step0 === '2') {
      const { data: listings } = await supabase
        .from('produce')
        .select('type, price_per_unit, unit')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(5)

      if (!listings || listings.length === 0) {
        return respond(res, 'END', 'Hakuna mazao yaliyoorodheshwa sasa.\nNo produce listed currently.')
      }

      const lines = listings.map(p => `${capitalize(p.type)}: KES ${p.price_per_unit}/${p.unit}`).join('\n')
      return respond(res, 'END', `Bei za sasa / Current prices:\n${lines}`)
    }

    // Option 3 — My orders
    if (step0 === '3') {
      const { data: myProduce } = await supabase
        .from('produce')
        .select('type, quantity, unit, status, ref')
        .eq('farmer_id', farmer.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (!myProduce || myProduce.length === 0) {
        return respond(res, 'END', 'Hujaorodhesha chochote bado.\nYou have no listings yet.\n\nTuma 1 kuanza.')
      }

      const statusSw = { available: 'Inasubiri', matched: 'Amepatikana', sold: 'Imeuzwa' }
      const lines = myProduce.map(p => `${p.ref}: ${capitalize(p.type)} ${p.quantity}${p.unit} — ${statusSw[p.status] || p.status}`).join('\n')
      return respond(res, 'END', `Mazao yako / Your listings:\n${lines}`)
    }

    // Option 4 — Cattle
    if (step0 === '4') {
      if (!step1) return respond(res, 'CON', 'Aina / Breed:\n(e.g. FRIESIAN, ZEBU, CROSSBREED)')
      if (!step2) return respond(res, 'CON', `Umri kwa miaka / Age in years:\n(e.g. 3)`)
      if (!step3) return respond(res, 'CON', `Bei (KES) / Price (KES):\n(e.g. 45000)`)

      const breed = step1.toLowerCase()
      const age = parseInt(step2)
      const price = parseFloat(step3)

      if (isNaN(age) || isNaN(price)) {
        return respond(res, 'END', 'Umri au bei si sahihi. Jaribu tena.\nInvalid age or price. Try again.')
      }

      const ref = generateRef('SL-CATTLE')
      await supabase.from('cattle').insert({ farmer_id: farmer.id, breed, age_years: age, price, ref })

      return respond(res, 'END',
        `✅ Imeorodheshwa!\n${capitalize(breed)}, miaka ${age}, KES ${price.toLocaleString()}\nRef: ${ref}\n\nWanunuzi wataarifiwa.\nBuyers will be notified.`
      )
    }

    // Option 5 — Help
    if (step0 === '5') {
      return respond(res, 'END',
        'MazaoLink Msaada:\n' +
        'Piga *384# — USSD (bila data)\n' +
        'Tuma SMS: SELL CHAI 50KG 380\n' +
        'WhatsApp: +254701338496\n' +
        'Barua pepe: hello@mazaolink.co.ke'
      )
    }

    respond(res, 'END', 'Chaguo si sahihi. Piga tena *384#.\nInvalid choice. Dial *384# again.')

  } catch (err) {
    console.error('USSD error:', err)
    respond(res, 'END', 'Hitilafu ya mfumo. Jaribu tena baadaye.\nSystem error. Please try again later.')
  }
})

async function getFarmer(phone) {
  const { data } = await supabase
    .from('farmers')
    .select('id, name, phone')
    .eq('phone', phone)
    .maybeSingle()
  return data
}

function respond(res, type, message) {
  res.set('Content-Type', 'text/plain')
  res.send(`${type} ${message}`)
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = router
