import Link from 'next/link'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

const STATUS_INFO = {
  pending:   { icon: '⏳', label: 'Pending', sub: 'Your order is awaiting confirmation from the farmer.' },
  confirmed: { icon: '✅', label: 'Confirmed', sub: 'The farmer has confirmed your order. Expect a call to arrange delivery.' },
  matched:   { icon: '🤝', label: 'Matched', sub: 'You have been matched with the farmer. They will contact you shortly.' },
  completed: { icon: '🎉', label: 'Completed', sub: 'Order delivered and payment processed. Thank you!' },
  cancelled: { icon: '❌', label: 'Cancelled', sub: 'This order was cancelled.' },
}

export default function OrderTracking({ order, error }) {
  if (error || !order) {
    return (
      <>
        <nav><div className="nav-inner"><Link href="/" className="logo">🌿 MazaoLink</Link></div></nav>
        <div className="track-wrap">
          <div className="empty">
            <div className="empty-icon">⚠️</div>
            <p>Order not found.</p>
            <Link href="/" style={{ color: 'var(--green)', fontWeight: 600, marginTop: 16, display: 'inline-block' }}>← Browse listings</Link>
          </div>
        </div>
      </>
    )
  }

  const s = STATUS_INFO[order.status] || STATUS_INFO.pending

  return (
    <>
      <nav>
        <div className="nav-inner">
          <Link href="/" className="logo">🌿 MazaoLink</Link>
          <Link href="/" className="nav-link">Browse listings</Link>
        </div>
      </nav>

      <div className="track-wrap">
        <Link href="/" className="back-link">← Marketplace</Link>

        <div className="track-card">
          <div className="track-status">
            <div className="status-icon">{s.icon}</div>
            <div className="status-label">{s.label}</div>
            <div className="status-sub">{s.sub}</div>
          </div>

          <div className="track-details">
            <div className="track-row">
              <span>Order ID</span>
              <span>#{order.id}</span>
            </div>
            <div className="track-row">
              <span>Buyer</span>
              <span>{order.buyerName}</span>
            </div>
            <div className="track-row">
              <span>Item</span>
              <span>{order.title || order.listingRef}</span>
            </div>
            {order.quantity && (
              <div className="track-row">
                <span>Quantity</span>
                <span>{order.quantity}</span>
              </div>
            )}
            <div className="track-row">
              <span>Total</span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>{order.totalLabel}</span>
            </div>
            <div className="track-row">
              <span>Placed</span>
              <span>{new Date(order.createdAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
          </div>

          <div style={{ marginTop: 24, padding: '16px', background: 'var(--green-pale)', borderRadius: 12, fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
            📞 The farmer will call you directly to arrange delivery.<br />
            Payment via <strong>M-Pesa</strong> — you'll receive a payment request on your phone.
          </div>
        </div>
      </div>

      <footer>© 2026 MazaoLink · Nakuru County, Kenya</footer>
    </>
  )
}

export async function getServerSideProps({ params }) {
  try {
    const res = await fetch(`${API}/api/orders/${params.ref}`)
    if (!res.ok) return { props: { order: null, error: true } }
    const order = await res.json()
    return { props: { order } }
  } catch {
    return { props: { order: null, error: true } }
  }
}
