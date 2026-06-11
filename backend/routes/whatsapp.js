const express = require('express')
const router = express.Router()
const { dispatch } = require('../lib/farmerCommands')
const { sendWhatsApp } = require('../lib/whatsapp')

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mazaolink123'

// ── GET /webhook/whatsapp — Meta webhook verification ──────────────────────
router.get('/', (req, res) => {
  const mode = req.query['hub.mode']
  const token = req.query['hub.verify_token']
  const challenge = req.query['hub.challenge']

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified')
    return res.status(200).send(challenge)
  }
  res.sendStatus(403)
})

// ── POST /webhook/whatsapp — Incoming messages from Meta ───────────────────
router.post('/', async (req, res) => {
  // Acknowledge immediately — Meta requires 200 within 5s
  res.sendStatus(200)

  try {
    const body = req.body
    if (body.object !== 'whatsapp_business_account') return

    const entry = body.entry?.[0]
    const change = entry?.changes?.[0]
    const value = change?.value

    // Skip status updates (delivery receipts, etc.)
    if (!value?.messages) return

    const msg = value.messages[0]
    if (msg.type !== 'text') return // only handle plain text for now

    const from = msg.from           // e.g. "254712345678"
    const text = msg.text.body || ''

    console.log(`[WhatsApp] From: ${from} | Text: ${text}`)

    const reply = await dispatch(from, text)
    await sendWhatsApp(from, reply)
  } catch (err) {
    console.error('[WhatsApp] Handler error:', err.message)
  }
})

module.exports = router
