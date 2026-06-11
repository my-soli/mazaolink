const supabase = require('./supabase')
const { generateRef } = require('./ref')
const { notifyBuyers } = require('./notify')
const { getForecast, formatQuerySMS } = require('./weather')

async function dispatch(phone, rawText) {
  const text = (rawText || '').trim().toUpperCase()
  const parts = text.split(/\s+/)
  const cmd = parts[0]

  try {
    if (cmd === 'REG')     return reg(phone, parts.slice(1).join(' '))
    if (cmd === 'SELL')    return sell(phone, parts.slice(1))
    if (cmd === 'STATUS')  return status(phone, parts[1])
    if (cmd === 'CANCEL')  return cancel(phone, parts[1])
    if (cmd === 'LIST')    return list(phone)
    if (cmd === 'PRICE')   return price(parts[1])
    if (cmd === 'BALANCE') return balance(phone)
    if (cmd === 'WEATHER') return weather(phone, parts[1])
    if (cmd === 'VILLAGE') return setVillage(phone, parts.slice(1).join(' '))
    if (cmd === 'HELP')    return help()
  } catch (err) {
    console.error('[farmerCommands]', err)
    return 'Hitilafu ya mfumo. Jaribu tena. / System error. Try again.'
  }

  return 'Amri haijulikani. Tuma HELP.\nUnknown command. Send HELP.'
}

// ── REG <full name> ──────────────────────────────────────────────────────────
async function reg(phone, name) {
  if (!name) return 'Tuma: REG JINA LAKO KAMILI\nMfano: REG John Kamau'

  const { data: existing } = await supabase
    .from('farmers').select('id, name').eq('phone', phone).maybeSingle()

  if (existing) return `Tayari umesajiliwa kama ${existing.name}.\nTuma SELL kuorodhesha au HELP kwa msaada.`

  const { error } = await supabase.from('farmers').insert({ phone, name, registered_via: 'sms' })
  if (error) throw error

  return (
    `✅ Karibu MazaoLink, ${name.split(' ')[0]}! Umesajiliwa.\n` +
    `Mifano:\nSELL CHAI 50KG 380\nSELL MAZIWA 80L 55\n` +
    `SELL NG'OMBE FRIESIAN 3YRS 45000\n` +
    `Tuma HELP kwa orodha kamili ya amri.`
  )
}

// ── SELL ─────────────────────────────────────────────────────────────────────
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

  return `✅ Imeorodheshwa!\n${cap(type)} ${quantity}${unit} @ KES ${price}/${unit}\nRef: ${ref}\nOrodha itaisha siku 7. Tuma STATUS ${ref} kuangalia.`
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

// ── STATUS <ref> ─────────────────────────────────────────────────────────────
async function status(phone, ref) {
  if (!ref) return 'Tuma: STATUS SL-XXXX'

  const { data: produce } = await supabase
    .from('produce').select('type, quantity, unit, price_per_unit, status').eq('ref', ref).maybeSingle()

  if (produce) {
    const sw = { available: 'Inasubiri mnunuzi', matched: 'Mnunuzi amepatikana', sold: 'Imeuzwa', expired: 'Imeisha muda' }
    return `Ref ${ref}: ${cap(produce.type)} ${produce.quantity}${produce.unit} @ KES ${produce.price_per_unit}\nHali: ${sw[produce.status] || produce.status}`
  }

  const { data: cattle } = await supabase
    .from('cattle').select('breed, age_years, price, status').eq('ref', ref).maybeSingle()

  if (cattle) {
    const sw = { available: 'Inasubiri mnunuzi', matched: 'Mnunuzi amepatikana', sold: 'Imeuzwa', expired: 'Imeisha muda' }
    return `Ref ${ref}: ${cap(cattle.breed)}, miaka ${cattle.age_years}, KES ${cattle.price.toLocaleString()}\nHali: ${sw[cattle.status] || cattle.status}`
  }

  return `Ref ${ref} haikupatikana. Angalia namba na ujaribu tena.`
}

// ── CANCEL <ref> ─────────────────────────────────────────────────────────────
async function cancel(phone, ref) {
  if (!ref) return 'Tuma: CANCEL SL-XXXX'

  const farmer = await getFarmer(phone)
  if (!farmer) return 'Bado hujasajiliwa.'

  // Try produce
  const { data: produce } = await supabase
    .from('produce').select('id, type, status, farmer_id').eq('ref', ref).maybeSingle()

  if (produce) {
    if (produce.farmer_id !== farmer.id) return 'Orodha hii si yako.'
    if (produce.status === 'matched') return `Orodha ${ref} ina mnunuzi tayari. Wasiliana nawe kabla ya kufuta.`
    if (produce.status !== 'available') return `Orodha ${ref} haiwezi kufutwa (hali: ${produce.status}).`

    await supabase.from('produce').update({ status: 'cancelled' }).eq('id', produce.id)
    return `✅ Orodha ${ref} (${cap(produce.type)}) imefutwa.`
  }

  // Try cattle
  const { data: cattle } = await supabase
    .from('cattle').select('id, breed, status, farmer_id').eq('ref', ref).maybeSingle()

  if (cattle) {
    if (cattle.farmer_id !== farmer.id) return 'Orodha hii si yako.'
    if (cattle.status === 'matched') return `Orodha ${ref} ina mnunuzi tayari. Wasiliana nawe kabla ya kufuta.`
    if (cattle.status !== 'available') return `Orodha ${ref} haiwezi kufutwa.`

    await supabase.from('cattle').update({ status: 'cancelled' }).eq('id', cattle.id)
    return `✅ Orodha ${ref} (${cap(cattle.breed)}) imefutwa.`
  }

  return `Ref ${ref} haikupatikana.`
}

// ── LIST — my active listings ─────────────────────────────────────────────────
async function list(phone) {
  const farmer = await getFarmer(phone)
  if (!farmer) return 'Bado hujasajiliwa.'

  const [{ data: produce }, { data: cattle }] = await Promise.all([
    supabase.from('produce').select('ref, type, quantity, unit, price_per_unit, status')
      .eq('farmer_id', farmer.id).in('status', ['available', 'matched'])
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('cattle').select('ref, breed, price, status')
      .eq('farmer_id', farmer.id).in('status', ['available', 'matched'])
      .order('created_at', { ascending: false }).limit(3)
  ])

  const lines = []
  const sw = { available: '⏳', matched: '🤝' }

  for (const p of produce || []) {
    lines.push(`${sw[p.status] || '?'} ${p.ref}: ${cap(p.type)} ${p.quantity}${p.unit} KES ${p.price_per_unit}`)
  }
  for (const c of cattle || []) {
    lines.push(`${sw[c.status] || '?'} ${c.ref}: ${cap(c.breed)} KES ${c.price.toLocaleString()}`)
  }

  if (lines.length === 0) return 'Huna orodha zilizo wazi sasa.\nTuma SELL kuanza kuuza.'

  return `Orodha zako:\n${lines.join('\n')}\n\n⏳=Inasubiri 🤝=Amepatikana\nTuma CANCEL <ref> kufuta.`
}

// ── PRICE <type> ─────────────────────────────────────────────────────────────
async function price(type) {
  if (!type) {
    // Return all market prices
    const { data } = await supabase.from('market_prices')
      .select('type, price_per_unit, unit').order('type')

    if (!data || data.length === 0) return 'Hakuna bei za soko sasa hivi.'
    const lines = data.map(p => `${cap(p.type)}: KES ${p.price_per_unit}/${p.unit}`).join('\n')
    return `Bei za soko leo / Market prices:\n${lines}`
  }

  const { data } = await supabase.from('market_prices')
    .select('type, price_per_unit, unit').eq('type', type.toLowerCase()).maybeSingle()

  if (!data) return `Hakuna bei ya soko kwa "${type}". Tuma PRICE kwa orodha yote.`
  return `Bei ya soko: ${cap(data.type)} = KES ${data.price_per_unit}/${data.unit} leo.`
}

// ── BALANCE ───────────────────────────────────────────────────────────────────
async function balance(phone) {
  const farmer = await getFarmer(phone)
  if (!farmer) return 'Bado hujasajiliwa.'

  const { data: paid } = await supabase.from('transactions')
    .select('amount').eq('phone', phone).eq('type', 'b2c').eq('status', 'completed')

  const { data: pending } = await supabase.from('transactions')
    .select('amount').eq('phone', phone).eq('type', 'b2c').eq('status', 'pending')

  const totalPaid = (paid || []).reduce((s, t) => s + Number(t.amount), 0)
  const totalPending = (pending || []).reduce((s, t) => s + Number(t.amount), 0)

  let msg = `💰 Mapato yako, ${farmer.name.split(' ')[0]}:\n`
  msg += `Umelipwa: KES ${totalPaid.toLocaleString()}\n`
  if (totalPending > 0) msg += `Inangoja malipo: KES ${totalPending.toLocaleString()}\n`
  msg += `\nJuu ya malipo, MazaoLink inachukua 5% kamisheni.`
  return msg
}

// ── WEATHER [ON|OFF] ──────────────────────────────────────────────────────────
async function weather(phone, sub) {
  if (sub === 'ON') {
    await supabase.from('farmers').update({ weather_opt_in: true }).eq('phone', phone)
    return '✅ Utapata SMS ya hali ya hewa kila asubuhi saa 12 (6am).\nTuma WEATHER OFF kusimamisha.'
  }

  if (sub === 'OFF') {
    await supabase.from('farmers').update({ weather_opt_in: false }).eq('phone', phone)
    return '✅ Umesimamisha arifa za hali ya hewa.'
  }

  // Instant weather query
  const farmer = await getFarmer(phone)
  const village = farmer?.village || 'olenguruone'

  try {
    const forecast = await getForecast(village)
    return formatQuerySMS(forecast)
  } catch {
    return 'Samahani, habari za hewa hazipatikani sasa. Jaribu tena baadaye.'
  }
}

// ── VILLAGE <name> ────────────────────────────────────────────────────────────
async function setVillage(phone, village) {
  if (!village) return 'Tuma: VILLAGE JINA_LA_MJI\nMfano: VILLAGE Olenguruone'

  const farmer = await getFarmer(phone)
  if (!farmer) return 'Bado hujasajiliwa. Tuma: REG JINA LAKO KAMILI'

  const { error } = await supabase.from('farmers')
    .update({ village: village.charAt(0).toUpperCase() + village.slice(1).toLowerCase() })
    .eq('phone', phone)

  if (error) throw error
  return `✅ Eneo lako limehifadhiwa: ${village}.\nSasa WEATHER itakuonyesha hali ya hewa sahihi kwa eneo lako.`
}

// ── HELP ──────────────────────────────────────────────────────────────────────
function help() {
  return (
    'MazaoLink — Amri zote:\n' +
    'REG Jina — Jisajili\n' +
    'SELL CHAI 50KG 380 — Orodhesha mazao\n' +
    "SELL NG'OMBE FRIESIAN 3YRS 45000 — Mifugo\n" +
    'STATUS SL-XXXX — Hali ya orodha\n' +
    'CANCEL SL-XXXX — Futa orodha\n' +
    'LIST — Orodha zangu zote\n' +
    'PRICE CHAI — Bei ya soko\n' +
    'BALANCE — Mapato yangu\n' +
    'WEATHER — Hali ya hewa sasa\n' +
    'WEATHER ON/OFF — Arifa za kila siku\n' +
    'VILLAGE Olenguruone — Weka eneo lako\n' +
    'Piga *384# kwa USSD bila data'
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────
async function getFarmer(phone) {
  const { data } = await supabase
    .from('farmers').select('id, name, phone, village, weather_opt_in').eq('phone', phone).maybeSingle()
  return data
}

function cap(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }

module.exports = { dispatch }
