const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { generateRef } = require('../lib/ref')
const { notifyBuyers } = require('../lib/notify')
const { getForecast, formatQuerySMS } = require('../lib/weather')

router.post('/', async (req, res) => {
  const phone = (req.body.phoneNumber || '').trim()
  const text  = (req.body.text || '').trim()

  if (!phone) return res.sendStatus(400)

  try {
    const farmer = await getFarmer(phone)

    // ── Registration flow ────────────────────────────────────────────────────
    if (!farmer) {
      if (text === '') {
        return respond(res, 'CON',
          'Karibu MazaoLink!\nWelcome!\n\nIngiza jina lako kamili:\nEnter your full name:'
        )
      }
      await supabase.from('farmers').insert({ phone, name: text, registered_via: 'ussd' })
      return respond(res, 'END',
        `✅ Umesajiliwa, ${text.split(' ')[0]}!\nPiga tena *384# kuanza.\nDial *384# again to continue.`
      )
    }

    const parts = text.split('*')
    const [s0, s1, s2, s3, s4] = parts

    // ── Main menu ────────────────────────────────────────────────────────────
    if (text === '') {
      return respond(res, 'CON',
        `Karibu ${farmer.name.split(' ')[0]}!\n` +
        '1. Orodhesha mazao\n' +
        '2. Bei za soko\n' +
        '3. Orodha zangu\n' +
        '4. Mifugo\n' +
        '5. Hali ya hewa\n' +
        '6. Msaada'
      )
    }

    // ── 1. List produce ──────────────────────────────────────────────────────
    if (s0 === '1') {
      if (!s1) return respond(res, 'CON', 'Aina ya zao:\n(CHAI, MAZIWA, MBOGA, VIAZI, MAHINDI)')
      if (!s2) return respond(res, 'CON', `Kiasi cha ${s1.toLowerCase()}:\n(mfano: 50 kwa 50kg, 80 kwa 80L)`)
      if (!s3) return respond(res, 'CON', 'Bei kwa kila kiasi (KES):')

      const type = s1.toLowerCase()
      const quantity = parseFloat(s2)
      const price = parseFloat(s3)
      const unit = ['maziwa', 'milk'].includes(type) ? 'litres' : 'kg'

      if (isNaN(quantity) || isNaN(price)) {
        return respond(res, 'END', 'Kiasi au bei si sahihi. Piga *384# tena.')
      }

      const ref = generateRef('SL')
      await supabase.from('produce').insert({ farmer_id: farmer.id, type, quantity, unit, price_per_unit: price, ref })

      notifyBuyers({ category: 'produce', type, ref, priceLabel: `${price}/${unit}`, quantity, unit, location: farmer.village || 'Nakuru County' })
        .catch(e => console.error('[ussd notify]', e.message))

      return respond(res, 'END',
        `✅ Imeorodheshwa!\n${cap(type)} ${quantity}${unit} @ KES ${price}/${unit}\nRef: ${ref}\nMnunuzi atawasiliana nawe.`
      )
    }

    // ── 2. Market prices ─────────────────────────────────────────────────────
    if (s0 === '2') {
      const { data: prices } = await supabase
        .from('market_prices').select('type, price_per_unit, unit').order('type').limit(8)

      if (!prices || prices.length === 0) {
        return respond(res, 'END', 'Hakuna bei za soko sasa hivi.')
      }
      const lines = prices.map(p => `${cap(p.type)}: KES ${p.price_per_unit}/${p.unit}`).join('\n')
      return respond(res, 'END', `Bei za soko leo:\n${lines}`)
    }

    // ── 3. My listings ───────────────────────────────────────────────────────
    if (s0 === '3') {
      if (!s1) {
        // Show listings + option to cancel
        const [{ data: produce }, { data: cattle }] = await Promise.all([
          supabase.from('produce').select('ref, type, quantity, unit, status')
            .eq('farmer_id', farmer.id).in('status', ['available', 'matched'])
            .order('created_at', { ascending: false }).limit(4),
          supabase.from('cattle').select('ref, breed, status')
            .eq('farmer_id', farmer.id).in('status', ['available', 'matched'])
            .order('created_at', { ascending: false }).limit(2)
        ])

        const all = [
          ...(produce || []).map((p, i) => ({ i: i + 1, label: `${p.ref}: ${cap(p.type)} ${p.quantity}${p.unit}`, ref: p.ref, status: p.status })),
          ...(cattle || []).map((c, i) => ({ i: (produce?.length || 0) + i + 1, label: `${c.ref}: ${cap(c.breed)}`, ref: c.ref, status: c.status }))
        ]

        if (all.length === 0) {
          return respond(res, 'END', 'Huna orodha zilizo wazi.\nTuma 1 kuanza kuuza.')
        }

        const sw = { available: '⏳', matched: '🤝' }
        const lines = all.map(r => `${r.i}. ${sw[r.status] || ''} ${r.label}`).join('\n')
        return respond(res, 'CON', `Orodha zako:\n${lines}\n\n0. Futa orodha`)
      }

      // Cancel selected listing
      if (s1 === '0') {
        if (!s2) {
          // Re-show list with numbers for cancellation
          const { data: produce } = await supabase.from('produce').select('ref, type')
            .eq('farmer_id', farmer.id).eq('status', 'available').limit(5)
          if (!produce || produce.length === 0) return respond(res, 'END', 'Huna orodha za kufuta.')
          const lines = produce.map((p, i) => `${i + 1}. ${p.ref}: ${cap(p.type)}`).join('\n')
          return respond(res, 'CON', `Chagua orodha ya kufuta:\n${lines}`)
        }

        const { data: produce } = await supabase.from('produce').select('ref, type')
          .eq('farmer_id', farmer.id).eq('status', 'available').limit(5)
        const item = produce?.[parseInt(s2) - 1]
        if (!item) return respond(res, 'END', 'Nambari si sahihi.')
        await supabase.from('produce').update({ status: 'cancelled' }).eq('ref', item.ref)
        return respond(res, 'END', `✅ Orodha ya ${cap(item.type)} (${item.ref}) imefutwa.`)
      }
    }

    // ── 4. Cattle ────────────────────────────────────────────────────────────
    if (s0 === '4') {
      if (!s1) return respond(res, 'CON', 'Aina ya ng\'ombe / Breed:\n(FRIESIAN, ZEBU, CROSSBREED, AYRSHIRE)')
      if (!s2) return respond(res, 'CON', 'Umri kwa miaka / Age in years:\n(mfano: 3)')
      if (!s3) return respond(res, 'CON', 'Bei (KES) / Price:\n(mfano: 45000)')

      const breed = s1.toLowerCase()
      const age = parseInt(s2)
      const price = parseFloat(s3)

      if (isNaN(age) || isNaN(price)) {
        return respond(res, 'END', 'Umri au bei si sahihi. Piga *384# tena.')
      }

      const ref = generateRef('SL-CATTLE')
      await supabase.from('cattle').insert({ farmer_id: farmer.id, breed, age_years: age, price, ref })

      notifyBuyers({ category: 'cattle', type: breed, ref, priceLabel: price.toLocaleString(), quantity: 1, unit: 'head', location: farmer.village || 'Nakuru County' })
        .catch(e => console.error('[ussd cattle notify]', e.message))

      return respond(res, 'END',
        `✅ Imeorodheshwa!\n${cap(breed)}, miaka ${age}, KES ${price.toLocaleString()}\nRef: ${ref}`
      )
    }

    // ── 5. Weather ───────────────────────────────────────────────────────────
    if (s0 === '5') {
      if (!s1) {
        return respond(res, 'CON',
          'Hali ya Hewa:\n1. Angalia hewa sasa\n2. Washa arifa za kila siku\n3. Zima arifa za hewa'
        )
      }

      if (s1 === '1') {
        try {
          const forecast = await getForecast(farmer.village || 'olenguruone')
          const today = forecast.days[0]
          const rain = today.rainfall > 0 ? `Mvua: ${today.rainfall}mm. ` : 'Hakuna mvua. '
          return respond(res, 'END',
            `🌤 ${forecast.location} Leo:\n` +
            `Joto: ${today.minTemp}–${today.maxTemp}°C\n${rain}\n` +
            `Kesho: ${forecast.days[1]?.rainfall || 0}mm mvua`
          )
        } catch {
          return respond(res, 'END', 'Habari za hewa hazipatikani sasa. Jaribu tena.')
        }
      }

      if (s1 === '2') {
        await supabase.from('farmers').update({ weather_opt_in: true }).eq('phone', phone)
        return respond(res, 'END', '✅ Utapata SMS ya hewa kila asubuhi saa 12.\nTuma WEATHER OFF kusimamisha.')
      }

      if (s1 === '3') {
        await supabase.from('farmers').update({ weather_opt_in: false }).eq('phone', phone)
        return respond(res, 'END', '✅ Umesimamisha arifa za hewa.')
      }
    }

    // ── 6. Help ──────────────────────────────────────────────────────────────
    if (s0 === '6') {
      return respond(res, 'END',
        'MazaoLink Msaada:\n' +
        'SMS: SELL CHAI 50KG 380\n' +
        'SMS: CANCEL SL-XXXX\n' +
        'SMS: PRICE CHAI\n' +
        'SMS: BALANCE\n' +
        'SMS: WEATHER ON\n' +
        'WhatsApp: buy.mazaolink.co.ke\n' +
        'Barua: hello@mazaolink.co.ke'
      )
    }

    respond(res, 'END', 'Chaguo si sahihi. Piga tena *384#.')

  } catch (err) {
    console.error('USSD error:', err)
    respond(res, 'END', 'Hitilafu ya mfumo. Jaribu tena baadaye.')
  }
})

async function getFarmer(phone) {
  const { data } = await supabase
    .from('farmers').select('id, name, phone, village, weather_opt_in').eq('phone', phone).maybeSingle()
  return data
}

function respond(res, type, message) {
  res.set('Content-Type', 'text/plain')
  res.send(`${type} ${message}`)
}

function cap(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }

module.exports = router
