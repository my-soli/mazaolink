import Layout from '../components/Layout'
import supabase from '../lib/supabase'

export default function Cattle({ listings }) {
  return (
    <Layout title="Cattle Listings" subtitle={`${listings.length} animals listed`}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Cattle</span>
          <span className="card-count">{listings.length}</span>
        </div>
        {listings.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">🐄</div>
            <p>No cattle listed yet.<br />Farmers can list via SMS: SELL NG'OMBE FRIESIAN 3YRS 45000</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ref</th>
                <th>Farmer</th>
                <th>Breed</th>
                <th>Age</th>
                <th>Weight</th>
                <th>Price</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(c => (
                <tr key={c.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--earth)', fontWeight: 600 }}>{c.ref}</td>
                  <td style={{ fontWeight: 500 }}>{c.farmers?.name || '—'}</td>
                  <td style={{ textTransform: 'capitalize', fontWeight: 500 }}>{c.breed}</td>
                  <td>{c.age_years ? `${c.age_years} yrs` : '—'}</td>
                  <td>{c.weight_kg ? `${c.weight_kg} kg` : '—'}</td>
                  <td style={{ fontWeight: 600 }}>KES {(c.price || 0).toLocaleString()}</td>
                  <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString('en-KE')}</td>
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
    .from('cattle')
    .select('id, ref, breed, age_years, weight_kg, price, status, created_at, farmers(name, phone)')
    .order('created_at', { ascending: false })

  return { props: { listings: listings || [] } }
}
