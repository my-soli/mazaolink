const AT_USERNAME = process.env.AT_USERNAME || 'sandbox'
const AT_API_KEY = process.env.AT_API_KEY
const AT_SHORTCODE = process.env.AT_SHORTCODE

const BASE = AT_USERNAME === 'sandbox'
  ? 'https://api.sandbox.africastalking.com/version1'
  : 'https://api.africastalking.com/version1'

async function sendSMS(to, message) {
  if (!AT_API_KEY || AT_API_KEY === 'placeholder') {
    console.log('[SMS stub] To:', to, '| Msg:', message)
    return { stub: true }
  }

  const phones = Array.isArray(to) ? to.join(',') : to
  const params = new URLSearchParams({
    username: AT_USERNAME,
    to: phones,
    message,
    ...(AT_SHORTCODE && AT_SHORTCODE !== 'placeholder' ? { from: AT_SHORTCODE } : {})
  })

  const res = await fetch(`${BASE}/messaging`, {
    method: 'POST',
    headers: {
      apiKey: AT_API_KEY,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  })

  const data = await res.json()
  if (!res.ok) throw new Error(`AT SMS failed: ${JSON.stringify(data)}`)
  return data
}

module.exports = { sendSMS }
