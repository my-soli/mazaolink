const supabase = require('./supabase')
const { sendSMS } = require('./sms')

const APP_URL = process.env.APP_URL || 'http://localhost:3000'

// Called after a produce or cattle listing is created
async function notifyBuyers({ category, type, ref, priceLabel, quantity, unit, location }) {
  // Find buyers interested in this category or specific type
  const { data: buyers } = await supabase
    .from('buyers')
    .select('phone, name, interests')
    .eq('active', true)

  if (!buyers || buyers.length === 0) return

  // Filter to buyers who want this category/type
  const matched = buyers.filter(b => {
    if (!b.interests || b.interests.length === 0) return true // no filter = all
    return b.interests.includes(category) || b.interests.includes(type)
  })

  if (matched.length === 0) return

  const detail = category === 'cattle'
    ? `${capitalize(type)} — KES ${priceLabel}`
    : `${capitalize(type)} ${quantity}${unit} @ KES ${priceLabel}`

  const portalUrl = process.env.BUYER_PORTAL_URL || 'http://localhost:3002'
  const message =
    `🌾 MazaoLink: New listing!\n${detail}\n📍 ${location}\nOrder: ${portalUrl}/listing/${ref}\nReply STOP to unsubscribe.`

  const phones = matched.map(b => b.phone)

  try {
    await sendSMS(phones, message)
    console.log(`[notify] Sent to ${phones.length} buyer(s) for listing ${ref}`)
  } catch (err) {
    console.error('[notify] SMS send failed:', err.message)
  }
}

function capitalize(str = '') {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = { notifyBuyers }
