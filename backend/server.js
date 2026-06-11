require('dotenv').config()
const express = require('express')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS — allow buyer portal to call the API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// Routes
app.use('/webhook/sms', require('./routes/sms'))
app.use('/webhook/ussd', require('./routes/ussd'))
app.use('/webhook/mpesa', require('./routes/mpesa'))
app.use('/webhook/whatsapp', require('./routes/whatsapp'))
app.use('/api/mpesa', require('./routes/mpesa'))
app.use('/api/listings', require('./routes/listings'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/buyers', require('./routes/buyers'))
app.use('/api/cron', require('./routes/cron'))

// Health check — Vercel/Railway will ping this
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'MazaoLink API', version: '1.0.0' })
})

if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => console.log(`MazaoLink API running on port ${PORT}`))
}

module.exports = app
