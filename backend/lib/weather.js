// Open-Meteo — completely free, no API key
// Coordinates for Nakuru County farming areas
const COORDS = {
  olenguruone: { lat: -0.3833, lon: 35.8833, name: 'Olenguruone' },
  kiptagich:   { lat: -0.1833, lon: 35.4667, name: 'Kiptagich' },
  molo:        { lat: -0.2500, lon: 35.7333, name: 'Molo' },
  njoro:       { lat: -0.3500, lon: 35.9167, name: 'Njoro' },
  elburgon:    { lat: -0.0833, lon: 35.7167, name: 'Elburgon' },
  nakuru:      { lat: -0.3031, lon: 36.0800, name: 'Nakuru' },
}
const DEFAULT_LOC = COORDS.olenguruone

function getCoords(village = '') {
  return COORDS[village.toLowerCase().trim()] || DEFAULT_LOC
}

async function getForecast(village) {
  const loc = getCoords(village)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
    `&timezone=Africa%2FNairobi&forecast_days=4`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`)
  const data = await res.json()

  return {
    location: loc.name,
    days: data.daily.time.map((date, i) => ({
      date,
      maxTemp: Math.round(data.daily.temperature_2m_max[i]),
      minTemp: Math.round(data.daily.temperature_2m_min[i]),
      rainfall: Math.round(data.daily.precipitation_sum[i] * 10) / 10,
      code: data.daily.weathercode[i]
    }))
  }
}

// WMO weather codes → Swahili
function weatherDesc(code) {
  if (code === 0)            return 'Jua kali ☀️'
  if (code <= 2)             return 'Mawingu kidogo 🌤'
  if (code === 3)            return 'Mawingu mengi ☁️'
  if (code <= 48)            return 'Ukungu 🌫'
  if (code <= 55)            return 'Mvua ya unyevu 🌦'
  if (code <= 65)            return 'Mvua 🌧'
  if (code <= 77)            return 'Theluji/barafu 🌨'
  if (code <= 82)            return 'Mvua kubwa 🌧'
  if (code <= 99)            return 'Radi na mvua ⛈'
  return 'Hali haijulikani'
}

// Is today's weather extreme enough to warrant an alert?
function isExtreme(day) {
  return day.rainfall > 25 || day.maxTemp > 32 || day.minTemp < 8
}

// Daily SMS (short — fits within 160 chars)
function formatDailySMS(forecast) {
  const t = forecast.days[0]
  const desc = weatherDesc(t.code)
  const rain = t.rainfall > 0 ? `Mvua: ${t.rainfall}mm. ` : ''
  const advice = plantingAdvice(forecast)

  return (
    `🌤 MazaoLink Hali ya Hewa — ${forecast.location}\n` +
    `Leo: ${desc}\n` +
    `Joto: ${t.minTemp}–${t.maxTemp}°C. ${rain}\n` +
    `${advice}\n` +
    `Tuma WEATHER OFF kusimamisha arifa hizi.`
  )
}

// Instant weather query reply
function formatQuerySMS(forecast) {
  const t = forecast.days[0]
  const next3 = forecast.days.slice(1, 4)
    .map(d => `${d.date.slice(5)}: ${d.rainfall}mm, ${d.minTemp}–${d.maxTemp}°C`)
    .join('\n')

  return (
    `🌤 Hali ya Hewa — ${forecast.location}\n` +
    `Leo: ${weatherDesc(t.code)}\n` +
    `Joto: ${t.minTemp}–${t.maxTemp}°C\n` +
    `Mvua: ${t.rainfall}mm\n\n` +
    `Siku 3 zijazo:\n${next3}\n\n` +
    plantingAdvice(forecast)
  )
}

function plantingAdvice(forecast) {
  const totalRain = forecast.days.slice(0, 3).reduce((s, d) => s + d.rainfall, 0)
  const avgMax = forecast.days.slice(0, 3).reduce((s, d) => s + d.maxTemp, 0) / 3

  if (totalRain > 40) return '⚠️ Mvua nyingi. Hakikisha mifereji ya maji inafanya kazi. Usipande mbegu mpya.'
  if (totalRain > 15 && avgMax >= 16 && avgMax <= 26) return '✅ Hali nzuri kwa kupanda. Tumia mvua inayokuja.'
  if (totalRain > 5)  return '🌱 Mvua kidogo inatarajiwa. Mazuri kwa mboga za majani.'
  return '💧 Ukame unatarajiwa. Panga umwagiliaji kwa mazao yako.'
}

module.exports = { getForecast, formatDailySMS, formatQuerySMS, isExtreme, getCoords }
