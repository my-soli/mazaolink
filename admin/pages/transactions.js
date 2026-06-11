import Layout from '../components/Layout'
import supabase from '../lib/supabase'

export default function Transactions({ transactions, totalSettled }) {
  return (
    <Layout title="Transactions" subtitle={`KES ${totalSettled.toLocaleString()} total M-Pesa settled`}>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 24 }}>
        <div className="stat-card green">
          <div className="stat-label">Total Settled</div>
          <div className="stat-num">KES {totalSettled.toLocaleString()}</div>
          <div className="stat-sub">B2C payouts to farmers</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Transactions</div>
          <div className="stat-num">{transactions.length}</div>
          <div className="stat-sub">All M-Pesa entries</div>
        </div>
        <div className="stat-card gold">
          <div className="stat-label">Completed</div>
          <div className="stat-num">{transactions.filter(t => t.status === 'completed').length}</div>
          <div className="stat-sub">Successful settlements</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Transactions</span>
          <span className="card-count">{transactions.length}</span>
        </div>
        {transactions.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">💳</div>
            <p>No transactions yet. M-Pesa entries will appear here once orders are processed.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>M-Pesa Ref</th>
                <th>Phone</th>
                <th>Amount</th>
                <th>Type</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{t.mpesa_ref || '—'}</td>
                  <td style={{ color: 'var(--muted)' }}>{t.phone}</td>
                  <td style={{ fontWeight: 700, color: t.type === 'b2c' ? 'var(--green)' : 'var(--earth)' }}>
                    KES {(t.amount || 0).toLocaleString()}
                  </td>
                  <td><span className={`badge badge-${t.type}`}>{t.type === 'b2c' ? 'Farmer payout' : 'Buyer payment'}</span></td>
                  <td><span className={`badge badge-${t.status}`}>{t.status}</span></td>
                  <td style={{ color: 'var(--muted)' }}>{new Date(t.created_at).toLocaleDateString('en-KE')}</td>
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
  const { data: transactions } = await supabase
    .from('transactions')
    .select('id, mpesa_ref, phone, amount, type, status, created_at')
    .order('created_at', { ascending: false })

  const totalSettled = (transactions || [])
    .filter(t => t.status === 'completed' && t.type === 'b2c')
    .reduce((sum, t) => sum + (t.amount || 0), 0)

  return { props: { transactions: transactions || [], totalSettled } }
}
