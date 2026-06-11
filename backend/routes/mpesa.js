const express = require('express')
const router = express.Router()
const supabase = require('../lib/supabase')
const { stkPush, b2cPayout } = require('../lib/mpesa')
const { sendSMS } = require('../lib/sms')

// ── CALLBACKS FROM SAFARICOM ─────────────────────────────────────────────────

// STK Push callback — called by Safaricom after buyer pays or cancels
router.post('/stk-callback', async (req, res) => {
  res.sendStatus(200) // acknowledge immediately — Safaricom retries if no 200

  try {
    const callback = req.body?.Body?.stkCallback
    if (!callback) return

    const checkoutId = callback.MerchantRequestID
    const resultCode = callback.ResultCode // 0 = success
    const resultDesc = callback.ResultDesc

    if (resultCode !== 0) {
      console.log(`STK failed: ${resultDesc}`)
      await supabase.from('transactions')
        .update({ status: 'failed' })
        .eq('mpesa_ref', checkoutId)
      return
    }

    // Extract payment details from callback metadata
    const items = callback.CallbackMetadata?.Item || []
    const get = (name) => items.find(i => i.Name === name)?.Value

    const mpesaRef  = get('MpesaReceiptNumber')
    const amount    = get('Amount')
    const phone     = String(get('PhoneNumber') || '')

    // Mark transaction as completed
    await supabase.from('transactions').update({
      status: 'completed',
      mpesa_ref: mpesaRef
    }).eq('mpesa_ref', checkoutId)

    // Mark the linked order as confirmed
    const { data: txn } = await supabase
      .from('transactions')
      .select('order_id')
      .eq('mpesa_ref', mpesaRef)
      .maybeSingle()

    if (txn?.order_id) {
      await supabase.from('orders')
        .update({ status: 'confirmed' })
        .eq('id', txn.order_id)
    }

    console.log(`✅ STK payment received: ${mpesaRef} KES ${amount} from ${phone}`)
  } catch (err) {
    console.error('STK callback error:', err)
  }
})

// B2C Result — called by Safaricom after farmer payout
router.post('/b2c-result', async (req, res) => {
  res.sendStatus(200)

  try {
    const result = req.body?.Result
    if (!result) return

    const resultCode = result.ResultCode
    const occasion   = result.TransactionID

    if (resultCode !== 0) {
      console.log(`B2C failed: ${result.ResultDesc}`)
      await supabase.from('transactions')
        .update({ status: 'failed' })
        .eq('mpesa_ref', occasion)
      return
    }

    const items = result.ResultParameters?.ResultParameter || []
    const get = (name) => items.find(i => i.Key === name)?.Value

    const mpesaRef = get('TransactionReceipt')
    const amount   = get('TransactionAmount')

    await supabase.from('transactions').update({
      status: 'completed',
      mpesa_ref: mpesaRef
    }).eq('mpesa_ref', occasion)

    // Mark order as completed once farmer is paid
    const { data: txn } = await supabase
      .from('transactions')
      .select('order_id')
      .eq('mpesa_ref', mpesaRef)
      .maybeSingle()

    if (txn?.order_id) {
      await supabase.from('orders')
        .update({ status: 'completed' })
        .eq('id', txn.order_id)
    }

    // SMS farmer to confirm payout
    if (txn?.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('produce(farmers(phone, name)), cattle(farmers(phone, name))')
        .eq('id', txn.order_id)
        .maybeSingle()

      const farmer = order?.produce?.farmers || order?.cattle?.farmers
      if (farmer?.phone) {
        const msg =
          `💰 MazaoLink: Malipo yako ya KES ${Number(amount).toLocaleString()} ` +
          `yametumwa kwa M-Pesa yako.\nRef: ${mpesaRef}.\nAsante, ${farmer.name.split(' ')[0]}!`
        sendSMS(farmer.phone, msg).catch(e => console.error('[payout SMS]', e.message))
      }
    }

    console.log(`✅ B2C payout sent: ${mpesaRef} KES ${amount}`)
  } catch (err) {
    console.error('B2C result error:', err)
  }
})

// B2C Timeout — called if Safaricom couldn't process the payout in time
router.post('/b2c-timeout', async (req, res) => {
  res.sendStatus(200)
  console.log('B2C timeout received:', JSON.stringify(req.body))
})

// ── INTERNAL TRIGGERS (called by admin dashboard) ───────────────────────────

// Trigger STK Push — request payment from buyer
// POST /api/mpesa/stk-push  { orderId }
router.post('/trigger-stk', async (req, res) => {
  const { orderId } = req.body
  if (!orderId) return res.status(400).json({ error: 'orderId required' })

  try {
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_phone, total_price, produce(ref), cattle(ref)')
      .eq('id', orderId)
      .maybeSingle()

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (!order.buyer_phone) return res.status(400).json({ error: 'No buyer phone on order' })
    if (!order.total_price) return res.status(400).json({ error: 'No amount on order' })

    const ref = order.produce?.ref || order.cattle?.ref || order.id

    // Create pending transaction record
    const { data: txn } = await supabase.from('transactions').insert({
      order_id: order.id,
      amount: order.total_price,
      type: 'c2b',
      phone: order.buyer_phone,
      status: 'pending',
      mpesa_ref: `pending-${Date.now()}`
    }).select().single()

    // Fire STK Push
    const result = await stkPush({
      phone: order.buyer_phone,
      amount: order.total_price,
      ref,
      description: `MazaoLink order ${ref}`
    })

    // Store Safaricom's checkout request ID so we can match the callback
    if (result.CheckoutRequestID) {
      await supabase.from('transactions')
        .update({ mpesa_ref: result.CheckoutRequestID })
        .eq('id', txn.id)
    }

    res.json({ success: true, result })
  } catch (err) {
    console.error('STK trigger error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Trigger B2C — pay farmer for a completed order
// POST /api/mpesa/trigger-b2c  { orderId }
router.post('/trigger-b2c', async (req, res) => {
  const { orderId } = req.body
  if (!orderId) return res.status(400).json({ error: 'orderId required' })

  try {
    const { data: order } = await supabase
      .from('orders')
      .select(`
        id, total_price, status,
        produce(ref, farmer_id, farmers(phone, name)),
        cattle(ref, farmer_id, farmers(phone, name))
      `)
      .eq('id', orderId)
      .maybeSingle()

    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'confirmed') return res.status(400).json({ error: 'Order must be confirmed before paying farmer' })

    const farmer = order.produce?.farmers || order.cattle?.farmers
    const ref    = order.produce?.ref || order.cattle?.ref || order.id

    if (!farmer?.phone) return res.status(400).json({ error: 'Farmer phone not found' })

    // MazaoLink keeps 5% commission
    const commission = 0.05
    const farmerAmount = Math.floor(order.total_price * (1 - commission))

    // Create pending B2C transaction
    const { data: txn } = await supabase.from('transactions').insert({
      order_id: order.id,
      amount: farmerAmount,
      type: 'b2c',
      phone: farmer.phone,
      status: 'pending',
      mpesa_ref: `b2c-pending-${Date.now()}`
    }).select().single()

    // Fire B2C
    const result = await b2cPayout({
      phone: farmer.phone,
      amount: farmerAmount,
      ref
    })

    if (result.ConversationID) {
      await supabase.from('transactions')
        .update({ mpesa_ref: result.ConversationID })
        .eq('id', txn.id)
    }

    res.json({ success: true, farmerAmount, farmer: farmer.name, result })
  } catch (err) {
    console.error('B2C trigger error:', err)
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
