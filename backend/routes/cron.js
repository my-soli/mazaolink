const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { sendSMS } = require('../lib/sms')
const { getForecast, formatDailySMS, isExtreme } = require('../lib/weather')

// All cron endpoints require ?key=CRON_SECRET
function auth(req, res, next) {
  const secret = process.env.CRON_SECRET
  if (secret && req.query.key !== secret) return res.sendStatus(401)
  next()
}

// GET /api/cron/weather
// Call daily at 6am EAT via cron-job.org (free)
router.get('/weather', auth, async (req, res) => {
  res.json({ started: true }) // respond immediately — don't block cron caller

  try {
    const { data: farmers } = await supabase
      .from('farmers')
      .select('phone, name, village')
      .eq('weather_opt_in', true)

    if (!farmers || farmers.length === 0) return

    // Group by village to minimise API calls
    const byVillage = {}
    for (const f of farmers) {
      const v = (f.village || 'olenguruone').toLowerCase()
      if (!byVillage[v]) byVillage[v] = []
      byVillage[v].push(f)
    }

    for (const [village, group] of Object.entries(byVillage)) {
      try {
        const forecast = await getForecast(village)
        const msg = formatDailySMS(forecast)
        const phones = group.map(f => f.phone)
        await sendSMS(phones, msg)
        console.log(`[cron/weather] Sent to ${phones.length} farmer(s) in ${village}`)
      } catch (err) {
        console.error(`[cron/weather] ${village}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron/weather] Fatal:', err.message)
  }
})

// GET /api/cron/expire
// Call daily at midnight EAT — marks old listings as expired and notifies farmers
router.get('/expire', auth, async (req, res) => {
  res.json({ started: true })

  try {
    const now = new Date().toISOString()

    // Expire old produce
    const { data: expiredProduce } = await supabase
      .from('produce')
      .update({ status: 'expired' })
      .eq('status', 'available')
      .lt('expires_at', now)
      .select('ref, type, quantity, unit, farmer_id, farmers(phone, name)')

    // Expire old cattle
    const { data: expiredCattle } = await supabase
      .from('cattle')
      .update({ status: 'expired' })
      .eq('status', 'available')
      .lt('expires_at', now)
      .select('ref, breed, price, farmer_id, farmers(phone, name)')

    const notifications = []

    for (const p of expiredProduce || []) {
      if (p.farmers?.phone) {
        notifications.push({
          phone: p.farmers.phone,
          msg: `⏰ MazaoLink: Orodha yako ya ${cap(p.type)} ${p.quantity}${p.unit} (${p.ref}) imeisha muda wa siku 7.\nTuma SELL tena kukuorodhesha upya.`
        })
      }
    }

    for (const c of expiredCattle || []) {
      if (c.farmers?.phone) {
        notifications.push({
          phone: c.farmers.phone,
          msg: `⏰ MazaoLink: Orodha yako ya ${cap(c.breed)} KES ${Number(c.price).toLocaleString()} (${c.ref}) imeisha muda.\nTuma SELL NG'OMBE tena kukuorodhesha upya.`
        })
      }
    }

    for (const n of notifications) {
      sendSMS(n.phone, n.msg).catch(e => console.error('[expire SMS]', e.message))
    }

    console.log(`[cron/expire] Expired ${(expiredProduce || []).length} produce, ${(expiredCattle || []).length} cattle`)
  } catch (err) {
    console.error('[cron/expire] Fatal:', err.message)
  }
})

// GET /api/cron/weather-alerts
// Call every 6 hours — sends urgent alert if extreme weather detected
router.get('/weather-alerts', auth, async (req, res) => {
  res.json({ started: true })

  try {
    const { data: farmers } = await supabase
      .from('farmers')
      .select('phone, village')
      .not('phone', 'is', null)

    if (!farmers || farmers.length === 0) return

    const byVillage = {}
    for (const f of farmers) {
      const v = (f.village || 'olenguruone').toLowerCase()
      if (!byVillage[v]) byVillage[v] = []
      byVillage[v].push(f.phone)
    }

    for (const [village, phones] of Object.entries(byVillage)) {
      try {
        const forecast = await getForecast(village)
        const today = forecast.days[0]
        if (!isExtreme(today)) continue

        let alert = `⚠️ MazaoLink Tahadhari — ${forecast.location}:\n`
        if (today.rainfall > 25) alert += `Mvua kubwa inatarajiwa: ${today.rainfall}mm. Linda mazao yako.\n`
        if (today.maxTemp > 32)  alert += `Joto kali: ${today.maxTemp}°C. Mwagilia mazao yako.\n`
        if (today.minTemp < 8)   alert += `Baridi kali: ${today.minTemp}°C. Linda mimea dhidi ya baridi.\n`

        await sendSMS(phones, alert)
        console.log(`[cron/alerts] Extreme weather alert sent to ${phones.length} farmer(s) in ${village}`)
      } catch (err) {
        console.error(`[cron/alerts] ${village}:`, err.message)
      }
    }
  } catch (err) {
    console.error('[cron/alerts] Fatal:', err.message)
  }
})

function cap(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }

module.exports = router
