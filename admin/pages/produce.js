import Layout from '../components/Layout'
import supabase from '../lib/supabase'

export default function Produce({ listings }) {
  return (
    <Layout title="Produce Listings" subtitle={`${listings.length} total listings`}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Produce</span>
          <span className="card-count">{listings.length}</span>
        </div>
        {listings.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🌿</div>
            <p>No produce listed yet.<br />Farmers can list via SMS: SELL CHAI 50KG 380</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Farmer</th>
                <th>Phone</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Price</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(p => (
                <tr key={p.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{p.ref}</td>
                  <td style={{ fontWeight: 500 }}>{p.farmers?.name || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{p.farmers?.phone || '—'}</td>
                  <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{p.type}</td>
                  <td>{p.quantity} {p.unit}</td>
                  <td style={{ fontWeight: 600 }}>KES {p.price_per_unit}/{p.unit}</td>
                  <td><span className={`badge badge-${p.status}`}>{p.status}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(p.created_at).toLocaleDateString('en-KE')}</td>
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
  const { data: listings } = await supabase
    .from('produce')
    .select('id, ref, type, quantity, unit, price_per_unit, status, created_at, farmers(name, phone)')
    .order('created_at', { ascending: false })

  return { props: { listings: listings || [] } }
}
