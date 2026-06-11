import Link from 'next/link'
import { useState } from 'react'
import { getEmoji } from '../components/Nav'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

function AlertBanner() {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', interests: [] })
  const [status, setStatus] = useState('idle')

  const CATS = ['produce', 'tea', 'milk', 'vegetables', 'cattle']

  function toggleInterest(cat) {
    setForm(f => ({
      ...f,
      interests: f.interests.includes(cat)
        ? f.interests.filter(c => c !== cat)
        : [...f.interests, cat]
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch(`${API}/api/buyers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  if (!open) {
    return (
      <div className="alert-bar">
        <span>📲 Get SMS alerts when new listings arrive</span>
        <button onClick={() => setOpen(true)} className="alert-bar-btn">Sign up free</button>
      </div>
    )
  }

  return (
    <div className="alert-panel">
      {status === 'done' ? (
        <p style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>
          ✅ You're signed up! You'll get an SMS whenever a matching listing goes live.
        </p>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label>Name</label>
            <input type="text" required placeholder="Your name" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: '1 1 160px', marginBottom: 0 }}>
            <label>Phone (M-Pesa)</label>
            <input type="tel" required placeholder="0712345678" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group" style={{ flex: '2 1 280px', marginBottom: 0 }}>
            <label>Interests (optional)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {CATS.map(c => (
                <button key={c} type="button"
                  onClick={() => toggleInterest(c)}
                  className={`filter-btn${form.interests.includes(c) ? ' active' : ''}`}
                  style={{ padding: '4px 12px', fontSize: 12 }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="submit-btn" disabled={status === 'loading'}
            style={{ flex: '0 0 auto', width: 'auto', padding: '10px 20px' }}>
            {status === 'loading' ? 'Saving...' : 'Subscribe'}
          </button>
          {status === 'error' && <p style={{ color: 'red', fontSize: 12, width: '100%' }}>Something went wrong. Try again.</p>}
        </form>
      )}
    </div>
  )
}

export default function Marketplace({ listings }) {
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? listings
    : listings.filter(l => l.category === filter)

  return (
    <>
      <nav>
        <div className="nav-inner">
          <div className="logo">🌿 MazaoLink</div>
          <span className="nav-link">Fresh from Nakuru County farms</span>
        </div>
      </nav>

      <div className="hero">
        <div className="hero-inner">
          <h1>Fresh produce, direct from farm</h1>
          <p>Buy directly from farmers in Olenguruone and Kiptagich. Pay via M-Pesa. Same-day matching.</p>
        </div>
      </div>

      <AlertBanner />

      <div className="filters">
        {['all', 'produce', 'cattle'].map(f => (
          <button
            key={f}
            className={`filter-btn${filter === f ? ' active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? '🌾 All listings' : f === 'produce' ? '🌿 Produce' : '🐄 Cattle'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted)', alignSelf: 'center' }}>
          {filtered.length} listing{filtered.length !== 1 ? 's' : ''} available
        </span>
      </div>

      <div className="listings">
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🌾</div>
            <p>No listings available right now.<br />Check back soon — farmers list daily.</p>
          </div>
        ) : (
          <div className="grid">
            {filtered.map(item => (
              <Link href={`/listing/${item.ref}`} key={item.id} className="card">
                <div className="card-img" style={{ background: item.category === 'cattle' ? 'var(--earth-pale)' : 'var(--green-pale)' }}>
                  {getEmoji(item.category === 'cattle' ? item.breed : item.type)}
                </div>
                <div className="card-body">
                  <div className="card-category">{item.category}</div>
                  <div className="card-title">{item.title}</div>
                  <div className="card-detail">{item.detail}</div>
                  <div className="card-price">{item.priceLabel}</div>
                  <div className="card-location">📍 {item.location}</div>
                  <div className="card-btn">View & Order</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer>© 2026 MazaoLink · Nakuru County, Kenya · hello@mazaolink.co.ke</footer>
    </>
  )
}

export async function getServerSideProps() {
  try {
    const res = await fetch(`${API}/api/listings`)
    const listings = await res.json()
    return { props: { listings: Array.isArray(listings) ? listings : [] } }
  } catch {
    return { props: { listings: [] } }
  }
}
