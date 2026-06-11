const PHONE_ID = process.env.WHATSAPP_PHONE_ID
const TOKEN = process.env.WHATSAPP_TOKEN
const API = `https://graph.facebook.com/v19.0/${PHONE_ID}/messages`

async function sendWhatsApp(to, message) {
  if (!TOKEN || TOKEN === 'placeholder' || !PHONE_ID || PHONE_ID === 'placeholder') {
    console.log('[WhatsApp stub] To:', to, '| Msg:', message)
    return { stub: true }
  }

  const res = await fetch(API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message, preview_url: false }
    })
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`WhatsApp API error: ${JSON.stringify(data)}`)
  return data
}

module.exports = { sendWhatsApp }
