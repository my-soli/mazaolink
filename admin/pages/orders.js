import Layout from '../components/Layout'
import supabase from '../lib/supabase'

const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled']

export default function Orders({ orders }) {
  return (
    <Layout title="Orders" subtitle={`${orders.length} total orders`}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Orders</span>
          <span className="card-count">{orders.length}</span>
        </div>
        {orders.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📦</div>
            <p>No orders yet. Orders are created when a buyer confirms interest in a listing.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Buyer</th>
                <th>Phone</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 500 }}>{o.buyer_name || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{o.buyer_phone || '—'}</td>
                  <td style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>
                    {o.produce?.type || o.cattle?.breed || '—'}
                  </td>
                  <td>{o.quantity || '—'}</td>
                  <td style={{ fontWeight: 600 }}>
                    {o.total_price ? `KES ${o.total_price.toLocaleString()}` : '—'}
                  </td>
                  <td><span className={`badge badge-${o.status}`}>{o.status}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(o.created_at).toLocaleDateString('en-KE')}</td>
                  <td>
                    {o.status !== 'completed' && o.status !== 'cancelled' && (
                      <form method="POST" action="/api/orders/update" style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={o.id} />
                        <select
                          name="status"
                          defaultValue={o.status}
                          onChange={e => e.target.form.submit()}
                          style={{
                            fontSize: 12,
                            padding: '4px 8px',
                            border: '1px solid var(--border)',
                            borderRadius: 6,
                            background: '#fff',
                            cursor: 'pointer',
                          }}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  )
}

export async function getServerSideProps() {
  const { data: orders } = await supabase
    .from('orders')
    .select('id, buyer_name, buyer_phone, quantity, total_price, status, created_at, produce(type), cattle(breed)')
    .order('created_at', { ascending: false })

  return { props: { orders: orders || [] } }
}
