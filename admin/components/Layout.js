import Link from 'next/link'
import { useRouter } from 'next/router'

const nav = [
  { href: '/',             icon: '📊', label: 'Dashboard' },
  { href: '/farmers',      icon: '👨‍🌾', label: 'Farmers' },
  { href: '/produce',      icon: '🌿', label: 'Produce' },
  { href: '/cattle',       icon: '🐄', label: 'Cattle' },
  { href: '/orders',       icon: '📦', label: 'Orders' },
  { href: '/transactions', icon: '💳', label: 'Transactions' },
]

export default function Layout({ children, title, subtitle }) {
  const router = useRouter()

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🌿</span> MazaoLink
        </div>
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item${router.pathname === item.href ? ' active' : ''}`}
          >
            <span className="nav-item-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
        <div style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid rgba(255,255,255,.15)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>
            MazaoLink Admin<br />
            Nakuru County Pilot
          </div>
        </div>
      </aside>

      <main className="main">
        {(title || subtitle) && (
          <div className="page-header">
            {title && <h1 className="page-title">{title}</h1>}
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
