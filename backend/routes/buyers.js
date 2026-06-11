const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// POST /api/buyers — register or update a buyer's notification preferences
// Body: { name, phone, interests: ['produce','tea','milk','cattle'] }
router.post('/', async (req, res) => {
  const { name, phone, interests = [] } = req.body

  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' })
  }

  const normalized = phone.replace(/\s+/g, '')

  const { data: existing } = await supabase
    .from('buyers')
    .select('id')
    .eq('phone', normalized)
    .maybeSingle()

  let result
  if (existing) {
    const { data, error } = await supabase
      .from('buyers')
      .update({ name, interests, active: true })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw error
    result = data
  } else {
    const { data, error } = await supabase
      .from('buyers')
      .insert({ name, phone: normalized, interests, active: true, registered_via: 'portal' })
      .select()
      .single()
    if (error) throw error
    result = data
  }

  res.json({ success: true, id: result.id, message: `You'll receive SMS alerts for new listings.` })
})

// DELETE /api/buyers/unsubscribe — opt out by phone
router.post('/unsubscribe', async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.status(400).json({ error: 'phone required' })

  await supabase
    .from('buyers')
    .update({ active: false })
    .eq('phone', phone.replace(/\s+/g, ''))

  res.json({ success: true, message: 'Unsubscribed from MazaoLink alerts.' })
})

// GET /api/buyers — admin: list all buyers
router.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('buyers')
    .select('id, name, phone, interests, active, registered_via, created_at')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

module.exports = router
