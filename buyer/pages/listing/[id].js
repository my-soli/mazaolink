import { useState } from 'react'
import Link from 'next/link'
import { getEmoji } from '../../components/Nav'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

export default function ListingDetail({ listing, error }) {
  const [form, setForm] = useState({ buyerName: '', buyerPhone: '', quantity: '', notes: '' })
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [orderRef, setOrderRef] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  if (error || !listing) {
    return (
      <>
        <nav><div className="nav-inner"><Link href="/" className="logo">🌿 MazaoLink</Link></div></nav>
        <div className="detail-wrap">
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <p>Listing not found or no longer available.</p>
            <Link href="/" style={{ color: 'var(--green)', fontWeight: 600, marginTop: 16, display: 'inline-block' }}>← Back to marketplace</Link>
          </div>
        </div>
      </>
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.buyerName || !form.buyerPhone) return

    setStatus('loading')
    try {
      const res = await fetch(`${API}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: listing.ref, ...form })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Order failed')
      setOrderRef(data.orderId)
      setStatus('success')
    } catch (err) {
      setErrMsg(err.message)
      setStatus('error')
    }
  }

  const emoji = getEmoji(listing.category === 'cattle' ? listing.breed : listing.type)
  const isAvailable = listing.status === 'available'

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="logo">🌿 MazaoLink</Link>
          <Link href="/" className="nav-link">← Back to listings</Link>
        </div>
      </nav>

      <div className="detail-wrap">
        <Link href="/" className="back-link">← All listings</Link>

        <div className="detail-card">
          <div className="detail-img" style={{ background: listing.category === 'cattle' ? 'var(--earth-pale)' : 'var(--green-pale)' }}>
            {emoji}
          </div>
          <div className="detail-body">
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--green-mid)', marginBottom: 6 }}>
              {listing.category}
            </div>
            <h1 className="detail-title">{listing.title}</h1>
            <div className="detail-price">{listing.priceLabel}</div>

            <div className="detail-meta">
              <div className="meta-item">
                <label>Available</label>
                <span>{listing.detail}</span>
              </div>
              <div className="meta-item">
                <label>Farmer</label>
                <span>{listing.farmer}</span>
              </div>
              <div className="meta-item">
                <label>Location</label>
                <span>📍 {listing.location}</span>
              </div>
              <div className="meta-item">
                <label>Listed</label>
                <span>{new Date(listing.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>

            {status === 'success' ? (
              <div className="success-box">
                <h3>✅ Order placed!</h3>
                <p>
                  Thank you, {form.buyerName}!<br />
                  We've matched you with the farmer. The farmer will call you to arrange delivery.<br /><br />
                  <strong>Order reference:</strong> #{orderRef}<br />
                  <Link href={`/order/${orderRef}`} style={{ color: 'var(--green)', fontWeight: 600 }}>Track your order →</Link>
                </p>
              </div>
            ) : !isAvailable ? (
              <div className="success-box" style={{ background: 'var(--gold-pale)', borderColor: 'var(--gold)' }}>
                <h3 style={{ color: 'var(--gold)' }}>⏳ Already matched</h3>
                <p>This listing has been matched with another buyer. Browse other listings.</p>
              </div>
            ) : (
              <form className="order-form" onSubmit={handleSubmit}>
                <h3>Place an order</h3>
                <div className="form-group">
                  <label>Your name *</label>
                  <input
                    type="text" required placeholder="e.g. Jane Wanjiku"
                    value={form.buyerName}
                    onChange={e => setForm({ ...form, buyerName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Phone number (M-Pesa) *</label>
                  <input
                    type="tel" required placeholder="e.g. 0712345678"
                    value={form.buyerPhone}
                    onChange={e => setForm({ ...form, buyerPhone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Quantity / amount</label>
                  <input
                    type="text" placeholder="e.g. 50kg or full listing"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <textarea
                    placeholder="Delivery instructions, special requests..."
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
                {status === 'error' && (
                  <p style={{ color: 'red', fontSize: 13, marginBottom: 12 }}>⚠️ {errMsg}</p>
                )}
                <button className="submit-btn" type="submit" disabled={status === 'loading'}>
                  {status === 'loading' ? 'Placing order...' : '📦 Place order'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <footer>© 2026 MazaoLink · Nakuru County, Kenya</footer>
    </>
  )
}

export async function getServerSideProps({ params }) {
  try {
    const res = await fetch(`${API}/api/listings/${params.id}`)
    if (!res.ok) return { props: { listing: null, error: true } }
    const listing = await res.json()
    return { props: { listing } }
  } catch {
    return { props: { listing: null, error: true } }
  }
}
