import supabase from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { id, status } = req.body
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled']

  if (!id || !allowed.includes(status)) return res.status(400).end()

  await supabase.from('orders').update({ status }).eq('id', id)

  res.redirect(302, '/orders')
}
