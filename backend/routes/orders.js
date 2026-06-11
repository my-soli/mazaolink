const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { generateRef } = require('../lib/ref')
const { sendSMS } = require('../lib/sms')

// POST /api/orders — buyer places an order
router.post('/', async (req, res) => {
  const { ref, buyerName, buyerPhone, quantity, notes } = req.body

  if (!ref || !buyerName || !buyerPhone) {
    return res.status(400).json({ error: 'ref, buyerName and buyerPhone are required' })
  }

  // Find the listing
  const { data: produce } = await supabase
    .from('produce').select('id, price_per_unit, quantity, unit, type, status').eq('ref', ref).maybeSingle()

  const { data: cattle } = !produce
    ? await supabase.from('cattle').select('id, price, breed, status').eq('ref', ref).maybeSingle()
    : { data: null }

  const listing = produce || cattle
  if (!listing) return res.status(404).json({ error: 'Listing not found' })
  if (listing.status !== 'available') return res.status(400).json({ error: 'This listing is no longer available' })

  // Calculate total
  const qty = produce ? (parseFloat(quantity) || listing.quantity) : 1
  const total = produce ? qty * listing.price_per_unit : listing.price

  const orderRef = generateRef('ORD')

  const orderData = {
    buyer_name: buyerName,
    buyer_phone: buyerPhone,
    quantity: qty,
    total_price: total,
    status: 'pending',
    notes: notes || null,
    ...(produce ? { produce_id: produce.id } : { cattle_id: cattle.id })
  }

  const { data: order, error } = await supabase
    .from('orders').insert(orderData).select().single()

  if (error) {
    console.error('Order insert error:', error)
    return res.status(500).json({ error: 'Failed to place order' })
  }

  // Mark listing as matched
  const table = produce ? 'produce' : 'cattle'
  await supabase.from(table).update({ status: 'matched' }).eq('id', listing.id)

  // Notify farmer via SMS
  notifyFarmer({ listing, produce, cattle, buyerName, quantity: qty, total, orderId: order.id })
    .catch(e => console.error('[notify farmer]', e.message))

  res.json({
    success: true,
    orderId: order.id,
    orderRef,
    total,
    message: `Order placed! We will send an M-Pesa payment request to ${buyerPhone} shortly.`
  })
})

// GET /api/orders/:id — track order
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const { data: order } = await supabase
    .from('orders')
    .select('id, buyer_name, quantity, total_price, status, notes, created_at, produce(type, unit, price_per_unit, ref), cattle(breed, price, ref)')
    .eq('id', id)
    .maybeSingle()

  if (!order) return res.status(404).json({ error: 'Order not found' })

  const listing = order.produce || order.cattle
  const title = order.produce
    ? `${order.produce.type} (${order.quantity} ${order.produce.unit})`
    : order.cattle ? `${order.cattle.breed}` : 'Unknown'

  res.json({
    id: order.id,
    buyerName: order.buyer_name,
    quantity: order.quantity,
    totalLabel: `KES ${Number(order.total_price).toLocaleString()}`,
    status: order.status,
    notes: order.notes,
    title,
    listingRef: listing?.ref || null,
    createdAt: order.created_at
  })
})

async function notifyFarmer({ listing, produce, cattle, buyerName, quantity, total, orderId }) {
  // Get farmer phone via produce/cattle -> farmer_id -> farmers
  const table = produce ? 'produce' : 'cattle'
  const id = produce ? produce.id : cattle.id

  const { data } = await supabase
    .from(table)
    .select('ref, farmer_id, farmers(phone, name)')
    .eq('id', id)
    .maybeSingle()

  if (!data?.farmers?.phone) return

  const farmerPhone = data.farmers.phone
  const ref = data.ref
  const itemDesc = produce
    ? `${cap(produce.type)} ${quantity}${produce.unit}`
    : `${cap(cattle.breed)}`

  const msg =
    `📦 MazaoLink: Agizo jipya!\n` +
    `${buyerName} anataka ${itemDesc} yako.\n` +
    `Bei: KES ${Number(total).toLocaleString()}\n` +
    `Order #${orderId}\n` +
    `Atawasiliana nawe hivi karibuni.\n` +
    `Tuma STATUS ${ref} kuangalia hali.`

  await sendSMS(farmerPhone, msg)
}

function cap(str = '') { return str.charAt(0).toUpperCase() + str.slice(1) }

module.exports = router
