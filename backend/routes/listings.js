const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')

// GET /api/listings — all available produce + cattle
router.get('/', async (req, res) => {
  const { category } = req.query // produce | cattle | all (default: all)

  const [produceRes, cattleRes] = await Promise.all([
    category === 'cattle' ? { data: [] } :
      supabase.from('produce')
        .select('id, ref, type, quantity, unit, price_per_unit, created_at, farmers(name, village)')
        .eq('status', 'available')
        .order('created_at', { ascending: false }),

    category === 'produce' ? { data: [] } :
      supabase.from('cattle')
        .select('id, ref, breed, age_years, weight_kg, price, created_at, farmers(name, village)')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
  ])

  const produce = (produceRes.data || []).map(p => ({
    ...p,
    category: 'produce',
    title: capitalize(p.type),
    price: p.price_per_unit,
    priceLabel: `KES ${p.price_per_unit}/${p.unit}`,
    detail: `${p.quantity} ${p.unit} available`,
    location: p.farmers?.village || 'Nakuru County',
    farmer: firstName(p.farmers?.name),
    createdAt: p.created_at
  }))

  const cattle = (cattleRes.data || []).map(c => ({
    ...c,
    category: 'cattle',
    title: capitalize(c.breed),
    price: c.price,
    priceLabel: `KES ${c.price.toLocaleString()}`,
    detail: `${c.age_years ? c.age_years + ' yrs' : ''}${c.weight_kg ? ' · ' + c.weight_kg + 'kg' : ''}`.trim() || 'Inquiry only',
    location: c.farmers?.village || 'Nakuru County',
    farmer: firstName(c.farmers?.name),
    createdAt: c.created_at
  }))

  res.json([...produce, ...cattle])
})

// GET /api/listings/:ref — single listing
router.get('/:ref', async (req, res) => {
  const { ref } = req.params

  // Try produce first
  const { data: produce } = await supabase
    .from('produce')
    .select('id, ref, type, quantity, unit, price_per_unit, status, created_at, farmers(name, village)')
    .eq('ref', ref)
    .maybeSingle()

  if (produce) {
    return res.json({
      ...produce,
      category: 'produce',
      title: capitalize(produce.type),
      price: produce.price_per_unit,
      priceLabel: `KES ${produce.price_per_unit}/${produce.unit}`,
      detail: `${produce.quantity} ${produce.unit} available`,
      location: produce.farmers?.village || 'Nakuru County',
      farmer: firstName(produce.farmers?.name),
      createdAt: produce.created_at
    })
  }

  // Try cattle
  const { data: cattle } = await supabase
    .from('cattle')
    .select('id, ref, breed, age_years, weight_kg, price, status, created_at, farmers(name, village)')
    .eq('ref', ref)
    .maybeSingle()

  if (cattle) {
    return res.json({
      ...cattle,
      category: 'cattle',
      title: capitalize(cattle.breed),
      price: cattle.price,
      priceLabel: `KES ${cattle.price.toLocaleString()}`,
      detail: `${cattle.age_years ? cattle.age_years + ' yrs' : ''}${cattle.weight_kg ? ' · ' + cattle.weight_kg + 'kg' : ''}`.trim(),
      location: cattle.farmers?.village || 'Nakuru County',
      farmer: firstName(cattle.farmers?.name),
      createdAt: cattle.created_at
    })
  }

  res.status(404).json({ error: 'Listing not found' })
})

function capitalize(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }
function firstName(name = '') { return name.split(' ')[0] || 'Farmer' }

module.exports = router
