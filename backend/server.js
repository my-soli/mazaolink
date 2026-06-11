require('dotenv').config()
const express = require('express')
const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/webhook/sms', require('./routes/sms'))
app.use('/webhook/ussd', require('./routes/ussd'))

// Health check — Vercel/Railway will ping this
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'MazaoLink API', version: '1.0.0' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`MazaoLink API running on port ${PORT}`))

module.exports = app
