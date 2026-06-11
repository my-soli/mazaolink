import Layout from '../components/Layout'
import supabase from '../lib/supabase'

export default function Farmers({ farmers }) {
  return (
    <Layout title="Farmers" subtitle={`${farmers.length} registered farmers`}>
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Farmers</span>
          <span className="card-count">{farmers.length}</span>
        </div>
        {farmers.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">👨‍🌾</div>
            <p>No farmers registered yet.<br />They can register via SMS (REG), USSD (*384#), or WhatsApp.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Village</th>
                <th>Language</th>
                <th>Registered via</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {farmers.map((f, i) => (
                <tr key={f.id}>
                  <td style={{ color: 'var(--muted)', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{f.name || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{f.phone}</td>
                  <td style={{ color: 'var(--muted)', textTransform: 'capitalize' }}>{f.village || '—'}</td>
                  <td>
                    <span className="badge" style={{ background: 'var(--green-pale)', color: 'var(--green)' }}>
                      {f.language === 'sw' ? 'Swahili' : f.language === 'en' ? 'English' : f.language || 'sw'}
                    </span>
                  </td>
                  <td><span className={`badge badge-${f.registered_via || 'sms'}`}>{f.registered_via || 'sms'}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(f.created_at).toLocaleDateString('en-KE')}</td>
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
  const { data: farmers, error } = await supabase
    .from('farmers')
    .select('id, name, phone, village, language, registered_via, created_at')
    .order('created_at', { ascending: false })

  return { props: { farmers: farmers || [] } }
}
