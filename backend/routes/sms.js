const express = require('express')
const router = express.Router()
const { dispatch } = require('../lib/farmerCommands')

// Africa's Talking sends POST with form-encoded body
// Respond with plain text — AT delivers it back as SMS to the sender
router.post('/', async (req, res) => {
  const from = (req.body.from || '').trim()
  const text = (req.body.text || '').trim()

  if (!from || !text) return res.sendStatus(400)

  try {
    const reply = await dispatch(from, text)
    res.set('Content-Type', 'text/plain')
    res.send(reply)
  } catch (err) {
    console.error('SMS handler error:', err)
    res.set('Content-Type', 'text/plain')
    res.send('Hitilafu ya mfumo. Jaribu tena. / System error. Please try again.')
  }
})

module.exports = router
