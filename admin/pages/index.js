import Layout from '../components/Layout'
import supabase from '../lib/supabase'
import Link from 'next/link'

export default function Dashboard({ stats, recentFarmers, recentProduce, recentOrders }) {
  return (
    <Layout title="Dashboard" subtitle="MazaoLink pilot overview — Olenguruone & Kiptagich">

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-label">Farmers</div>
          <div className="stat-num">{stats.farmers}</div>
          <div className="stat-sub">Registered total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Produce Listed</div>
          <div className="stat-num">{stats.produce}</div>
          <div className="stat-sub">{stats.produceSold} sold · {stats.produceAvailable} available</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-label">Orders</div>
          <div className="stat-num">{stats.orders}</div>
          <div className="stat-sub">{stats.ordersPending} pending · {stats.ordersCompleted} completed</div>
        </div>
        <div className="stat-card earth">
          <div className="stat-label">M-Pesa Settled</div>
          <div className="stat-num">KES {stats.settled.toLocaleString()}</div>
          <div className="stat-sub">{stats.transactions} transactions</div>
        </div>
      </div>

      {/* V1 Progress */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">V1 Launch Targets</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Goal: May 31, 2026</span>
        </div>
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
          <ProgressBar label="Farmers registered" value={stats.farmers} target={50} color="var(--green)" />
          <ProgressBar label="Active buyers" value={stats.activeBuyers} target={5} color="var(--earth)" />
          <ProgressBar label="Completed transactions" value={stats.ordersCompleted} target={20} color="var(--gold)" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Recent farmers */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Farmers</span>
            <Link href="/farmers" className="btn btn-ghost" style={{ fontSize: 12 }}>View all</Link>
          </div>
          {recentFarmers.length === 0 ? (
            <div className="empty"><div className="empty-icon">👨‍🌾</div><p>No farmers yet</p></div>
          ) : (
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th>Via</th></tr></thead>
              <tbody>
                {recentFarmers.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 500 }}>{f.name || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{f.phone}</td>
                    <td><span className={`badge badge-${f.registered_via}`}>{f.registered_via}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent produce */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Listings</span>
            <Link href="/produce" className="btn btn-ghost" style={{ fontSize: 12 }}>View all</Link>
          </div>
          {recentProduce.length === 0 ? (
            <div className="empty"><div className="empty-icon">🌿</div><p>No listings yet</p></div>
          ) : (
            <table>
              <thead><tr><th>Type</th><th>Qty</th><th>Price</th><th>Status</th></tr></thead>
              <tbody>
                {recentProduce.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500, textTransform: 'capitalize' }}>{p.type}</td>
                    <td style={{ color: 'var(--muted)' }}>{p.quantity}{p.unit}</td>
                    <td>KES {p.price_per_unit}/{p.unit}</td>
                    <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent orders */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <span className="card-title">Recent Orders</span>
            <Link href="/orders" className="btn btn-ghost" style={{ fontSize: 12 }}>View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty"><div className="empty-icon">📦</div><p>No orders yet</p></div>
          ) : (
            <table>
              <thead><tr><th>Buyer</th><th>Phone</th><th>Produce</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 500 }}>{o.buyer_name || '—'}</td>
                    <td style={{ color: 'var(--muted)' }}>{o.buyer_phone || '—'}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{o.produce?.type || o.cattle?.breed || '—'}</td>
                    <td style={{ fontWeight: 600 }}>KES {(o.total_price || 0).toLocaleString()}</td>
                    <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                    <td style={{ color: 'var(--muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </Layout>
  )
}

function ProgressBar({ label, value, target, color }) {
  const pct = Math.min(100, Math.round((value / target) * 100))
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{value} / {target}</span>
      </div>
      <div style={{ height: 8, background: 'var(--border)', borderRadius: 100, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 100, transition: 'width .3s' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{pct}% of target</div>
    </div>
  )
}

export async function getServerSideProps() {
  const [
    { count: farmers },
    { count: produce },
    { count: produceSold },
    { count: produceAvailable },
    { count: orders },
    { count: ordersPending },
    { count: ordersCompleted },
    { count: transactions },
    { data: settled },
    { data: activeBuyersData },
    { data: recentFarmers },
    { data: recentProduce },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from('farmers').select('*', { count: 'exact', head: true }),
    supabase.from('produce').select('*', { count: 'exact', head: true }),
    supabase.from('produce').select('*', { count: 'exact', head: true }).eq('status', 'sold'),
    supabase.from('produce').select('*', { count: 'exact', head: true }).eq('status', 'available'),
    supabase.from('orders').select('*', { count: 'exact', head: true }),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('transactions').select('amount').eq('status', 'completed').eq('type', 'b2c'),
    supabase.from('orders').select('buyer_phone').eq('status', 'completed').not('buyer_phone', 'is', null),
    supabase.from('farmers').select('id, name, phone, registered_via').order('created_at', { ascending: false }).limit(5),
    supabase.from('produce').select('id, type, quantity, unit, price_per_unit, status').order('created_at', { ascending: false }).limit(5),
    supabase.from('orders').select('id, buyer_name, buyer_phone, total_price, status, created_at, produce(type), cattle(breed)').order('created_at', { ascending: false }).limit(5),
  ])

  const settledTotal = (settled || []).reduce((sum, t) => sum + (t.amount || 0), 0)
  const uniqueBuyers = new Set((activeBuyersData || []).map(o => o.buyer_phone)).size

  return {
    props: {
      stats: {
        farmers: farmers || 0,
        produce: produce || 0,
        produceSold: produceSold || 0,
        produceAvailable: produceAvailable || 0,
        orders: orders || 0,
        ordersPending: ordersPending || 0,
        ordersCompleted: ordersCompleted || 0,
        transactions: transactions || 0,
        settled: settledTotal,
        activeBuyers: uniqueBuyers,
      },
      recentFarmers: recentFarmers || [],
      recentProduce: recentProduce || [],
      recentOrders: recentOrders || [],
    }
  }
}
