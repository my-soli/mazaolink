const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { generateRef } = require('../lib/ref')

// Africa's Talking sends POST with form-encoded body
router.post('/', async (req, res) => {
  const from = (req.body.from || '').trim()
  const text = (req.body.text || '').trim().toUpperCase()

  if (!from || !text) return res.sendStatus(400)

  const parts = text.split(/\s+/)
  const command = parts[0]

  try {
    if (command === 'REG') {
      await handleReg(from, parts.slice(1).join(' '), res)
    } else if (command === 'SELL') {
      await handleSell(from, parts.slice(1), res)
    } else if (command === 'STATUS') {
      await handleStatus(from, parts[1], res)
    } else if (command === 'HELP') {
      await handleHelp(res)
    } else {
      sendSMS(res, 'Amri haijulikani. Tuma HELP kupata msaada. / Unknown command. Send HELP for instructions.')
    }
  } catch (err) {
    console.error('SMS error:', err)
    sendSMS(res, 'Hitilafu ya mfumo. Jaribu tena. / System error. Please try again.')
  }
})

// REG <full name>
// e.g. "REG John Kamau"
async function handleReg(phone, name, res) {
  if (!name) {
    return sendSMS(res, 'Tuma: REG JINA LAKO KAMILI\nMfano: REG John Kamau')
  }

  const { data: existing } = await supabase
    .from('farmers')
    .select('id, name')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    return sendSMS(res, `Tayari umesajiliwa kama ${existing.name}. Tuma SELL kuorodhesha mazao yako.`)
  }

  const { error } = await supabase.from('farmers').insert({
    phone,
    name,
    registered_via: 'sms'
  })

  if (error) throw error

  sendSMS(res, `✅ Karibu MazaoLink, ${name}! Umesajiliwa. Tuma:\nSELL CHAI 50KG 380\nSELL MAZIWA 80L 55\nSELL NG'OMBE FRIESIAN 3YRS 45000`)
}

// SELL <type> <qty><unit> <price>
// e.g. "SELL CHAI 50KG 380" or "SELL MAZIWA 80L 55" or "SELL NG'OMBE FRIESIAN 3YRS 45000"
async function handleSell(phone, parts, res) {
  const farmer = await getFarmer(phone)
  if (!farmer) {
    return sendSMS(res, 'Bado hujasajiliwa. Tuma: REG JINA LAKO KAMILI')
  }

  // Detect cattle listing: SELL COW/NG'OMBE <breed> <age>YRS <price>
  if (['COW', "NG'OMBE", 'NGOMBE', 'CATTLE'].includes(parts[0])) {
    return handleSellCattle(farmer, parts.slice(1), res)
  }

  // Produce: SELL <type> <qty><unit> <price>
  // parts = ['CHAI', '50KG', '380']
  if (parts.length < 3) {
    return sendSMS(res, 'Mfano: SELL CHAI 50KG 380\nAu: SELL MAZIWA 80L 55')
  }

  const type = parts[0].toLowerCase()
  const qtyUnit = parts[1]
  const price = parseFloat(parts[2])

  const qtyMatch = qtyUnit.match(/^(\d+\.?\d*)(KG|L|BAG|CRATE|PCS)?$/i)
  if (!qtyMatch || isNaN(price)) {
    return sendSMS(res, 'Kiasi au bei si sahihi. Mfano: SELL CHAI 50KG 380')
  }

  const quantity = parseFloat(qtyMatch[1])
  const unit = (qtyMatch[2] || 'kg').toLowerCase()
  const ref = generateRef('SL')

  const { error } = await supabase.from('produce').insert({
    farmer_id: farmer.id,
    type,
    quantity,
    unit,
    price_per_unit: price,
    ref
  })

  if (error) throw error

  sendSMS(res, `✅ Imeorodheshwa! ${capitalize(type)} ${quantity}${unit} @ KES ${price}/${unit}. Ref: ${ref}. Mnunuzi atawasiliana nawe hivi karibuni.`)
}

// SELL COW/NG'OMBE <breed> <age>YRS <price>
async function handleSellCattle(farmer, parts, res) {
  // parts = ['FRIESIAN', '3YRS', '45000']
  if (parts.length < 3) {
    return sendSMS(res, "Mfano: SELL NG'OMBE FRIESIAN 3YRS 45000")
  }

  const breed = parts[0].toLowerCase()
  const ageStr = parts[1].replace(/YRS?/i, '')
  const age = parseInt(ageStr)
  const price = parseFloat(parts[2])

  if (isNaN(age) || isNaN(price)) {
    return sendSMS(res, "Umri au bei si sahihi. Mfano: SELL NG'OMBE FRIESIAN 3YRS 45000")
  }

  const ref = generateRef('SL-CATTLE')

  const { error } = await supabase.from('cattle').insert({
    farmer_id: farmer.id,
    breed,
    age_years: age,
    price,
    ref
  })

  if (error) throw error

  sendSMS(res, `✅ Imeorodheshwa! ${capitalize(breed)}, miaka ${age}, KES ${price.toLocaleString()}. Ref: ${ref}. Wanunuzi wataarifiwa.`)
}

// STATUS <ref>
async function handleStatus(phone, ref, res) {
  if (!ref) return sendSMS(res, 'Tuma: STATUS SL-XXXX')

  const { data: produce } = await supabase
    .from('produce')
    .select('type, quantity, unit, price_per_unit, status, ref')
    .eq('ref', ref)
    .maybeSingle()

  if (produce) {
    const statusSw = { available: 'Inasubiri mnunuzi', matched: 'Mnunuzi amepatikana', sold: 'Imeuzwa' }
    return sendSMS(res, `Ref ${ref}: ${capitalize(produce.type)} ${produce.quantity}${produce.unit} @ KES ${produce.price_per_unit}. Hali: ${statusSw[produce.status] || produce.status}.`)
  }

  sendSMS(res, `Ref ${ref} haikupatikana. Angalia namba na ujaribu tena.`)
}

async function handleHelp(res) {
  sendSMS(res,
    'MazaoLink:\n' +
    'REG Jina Lako — Jisajili\n' +
    'SELL CHAI 50KG 380 — Orodhesha mazao\n' +
    'SELL MAZIWA 80L 55 — Orodhesha maziwa\n' +
    "SELL NG'OMBE FRIESIAN 3YRS 45000 — Orodhesha mifugo\n" +
    'STATUS SL-XXXX — Angalia hali\n' +
    'Piga *384# bila data'
  )
}

async function getFarmer(phone) {
  const { data } = await supabase
    .from('farmers')
    .select('id, name, phone')
    .eq('phone', phone)
    .maybeSingle()
  return data
}

function sendSMS(res, message) {
  res.set('Content-Type', 'text/plain')
  res.send(message)
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = router
