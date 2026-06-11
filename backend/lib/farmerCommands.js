const supabase = require('./supabase')
const { generateRef } = require('./ref')
const { notifyBuyers } = require('./notify')

// Returns a plain-text reply string for any farmer command.
// Channel-agnostic — caller decides how to send the reply.

async function dispatch(phone, rawText) {
  const text = (rawText || '').trim().toUpperCase()
  const parts = text.split(/\s+/)
  const command = parts[0]

  if (command === 'REG')    return reg(phone, parts.slice(1).join(' '))
  if (command === 'SELL')   return sell(phone, parts.slice(1))
  if (command === 'STATUS') return status(phone, parts[1])
  if (command === 'HELP')   return help()
  return 'Amri haijulikani. Tuma HELP kupata maelekezo.\nUnknown command. Send HELP for instructions.'
}

// REG <full name>
async function reg(phone, name) {
  if (!name) return 'Tuma: REG JINA LAKO KAMILI\nMfano: REG John Kamau'

  const { data: existing } = await supabase
    .from('farmers').select('id, name').eq('phone', phone).maybeSingle()

  if (existing) return `Tayari umesajiliwa kama ${existing.name}. Tuma SELL kuorodhesha mazao yako.`

  const { error } = await supabase.from('farmers').insert({ phone, name, registered_via: 'sms' })
  if (error) throw error

  return `✅ Karibu MazaoLink, ${name.split(' ')[0]}!\nUmesajiliwa. Orodhesha mazao:\nSELL CHAI 50KG 380\nSELL MAZIWA 80L 55\nSELL NG'OMBE FRIESIAN 3YRS 45000`
}

// SELL <type> <qty><unit> <price>  or  SELL COW/NG'OMBE <breed> <age>YRS <price>
async function sell(phone, parts) {
  const farmer = await getFarmer(phone)
  if (!farmer) return 'Bado hujasajiliwa. Tuma: REG JINA LAKO KAMILI'

  if (['COW', "NG'OMBE", 'NGOMBE', 'CATTLE'].includes(parts[0])) {
    return sellCattle(farmer, parts.slice(1))
  }

  if (parts.length < 3) return 'Mfano: SELL CHAI 50KG 380\nAu: SELL MAZIWA 80L 55'

  const type = parts[0].toLowerCase()
  const qtyUnit = parts[1]
  const price = parseFloat(parts[2])
  const qtyMatch = qtyUnit.match(/^(\d+\.?\d*)(KG|L|BAG|CRATE|PCS)?$/i)

  if (!qtyMatch || isNaN(price)) return 'Kiasi au bei si sahihi. Mfano: SELL CHAI 50KG 380'

  const quantity = parseFloat(qtyMatch[1])
  const unit = (qtyMatch[2] || 'kg').toLowerCase()
  const ref = generateRef('SL')

  const { error } = await supabase.from('produce').insert({
    farmer_id: farmer.id, type, quantity, unit, price_per_unit: price, ref
  })
  if (error) throw error

  notifyBuyers({
    category: 'produce', type, ref,
    priceLabel: `${price}/${unit}`, quantity, unit,
    location: farmer.village || 'Nakuru County'
  }).catch(e => console.error('[notify produce]', e.message))

  return `✅ Imeorodheshwa!\n${cap(type)} ${quantity}${unit} @ KES ${price}/${unit}\nRef: ${ref}\nMnunuzi atawasiliana nawe hivi karibuni.`
}

async function sellCattle(farmer, parts) {
  if (parts.length < 3) return "Mfano: SELL NG'OMBE FRIESIAN 3YRS 45000"

  const breed = parts[0].toLowerCase()
  const age = parseInt(parts[1].replace(/YRS?/i, ''))
  const price = parseFloat(parts[2])

  if (isNaN(age) || isNaN(price)) return "Umri au bei si sahihi. Mfano: SELL NG'OMBE FRIESIAN 3YRS 45000"

  const ref = generateRef('SL-CATTLE')

  const { error } = await supabase.from('cattle').insert({
    farmer_id: farmer.id, breed, age_years: age, price, ref
  })
  if (error) throw error

  notifyBuyers({
    category: 'cattle', type: breed, ref,
    priceLabel: price.toLocaleString(), quantity: 1, unit: 'head',
    location: farmer.village || 'Nakuru County'
  }).catch(e => console.error('[notify cattle]', e.message))

  return `✅ Imeorodheshwa!\n${cap(breed)}, miaka ${age}, KES ${price.toLocaleString()}\nRef: ${ref}\nWanunuzi wataarifiwa.`
}

// STATUS <ref>
async function status(phone, ref) {
  if (!ref) return 'Tuma: STATUS SL-XXXX'

  const { data: produce } = await supabase
    .from('produce').select('type, quantity, unit, price_per_unit, status')
    .eq('ref', ref).maybeSingle()

  if (produce) {
    const sw = { available: 'Inasubiri mnunuzi', matched: 'Mnunuzi amepatikana', sold: 'Imeuzwa' }
    return `Ref ${ref}: ${cap(produce.type)} ${produce.quantity}${produce.unit} @ KES ${produce.price_per_unit}\nHali: ${sw[produce.status] || produce.status}`
  }

  const { data: cattle } = await supabase
    .from('cattle').select('breed, age_years, price, status')
    .eq('ref', ref).maybeSingle()

  if (cattle) {
    const sw = { available: 'Inasubiri mnunuzi', matched: 'Mnunuzi amepatikana', sold: 'Imeuzwa' }
    return `Ref ${ref}: ${cap(cattle.breed)}, miaka ${cattle.age_years}, KES ${cattle.price.toLocaleString()}\nHali: ${sw[cattle.status] || cattle.status}`
  }

  return `Ref ${ref} haikupatikana. Angalia namba na ujaribu tena.`
}

function help() {
  return (
    'MazaoLink — Msaada:\n' +
    'REG Jina Lako — Jisajili\n' +
    'SELL CHAI 50KG 380 — Orodhesha mazao\n' +
    'SELL MAZIWA 80L 55 — Orodhesha maziwa\n' +
    "SELL NG'OMBE FRIESIAN 3YRS 45000 — Orodhesha mifugo\n" +
    'STATUS SL-XXXX — Angalia hali ya orodha\n' +
    'Piga *384# kwa USSD bila data'
  )
}

async function getFarmer(phone) {
  const { data } = await supabase.from('farmers').select('id, name, phone, village').eq('phone', phone).maybeSingle()
  return data
}

function cap(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }

module.exports = { dispatch }
