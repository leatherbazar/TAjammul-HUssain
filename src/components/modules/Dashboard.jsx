import React, { useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

function StatCard({ label, value, sub, className, icon }) {
  return (
    <div className={`stat-card ${className}`} data-icon={icon}>
      <div className="label">{label}</div>
      <div className="value">PKR {Number(value || 0).toLocaleString()}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function WalletCard({ icon, name, amount, color }) {
  return (
    <div className="wallet-card glass">
      <div className="wallet-icon">{icon}</div>
      <div className="wallet-info">
        <div className="wname" style={{ color }}>{name}</div>
        <div className="wamt" style={{ color }}>PKR {Number(amount || 0).toLocaleString()}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, currentUser } = useApp()

  const stats = useMemo(() => {
    const invoices = data.invoices || []
    const quotations = data.quotations || []
    const target = quotations.reduce((s, q) => s + (q.total || 0), 0)
    const recovery = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
    const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + ((i.total || 0) - (i.advancePaid || 0)), 0)
    return { target, recovery, outstanding }
  }, [data])

  const chartData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map(m => ({
      month: m,
      invoiced: Math.floor(Math.random() * 200000) + 50000,
      recovered: Math.floor(Math.random() * 150000) + 30000,
    }))
  }, [])

  const recentDocs = useMemo(() => {
    const all = [
      ...(data.quotations || []).map(q => ({ ...q, type: 'Quotation', icon: '📋' })),
      ...(data.invoices || []).map(i => ({ ...i, type: 'Invoice', icon: '🧾' })),
      ...(data.deliveryNotes || []).map(d => ({ ...d, type: 'Delivery Note', icon: '🚚' })),
    ]
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8)
  }, [data])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📊 <span>Dashboard</span></h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Master Cards */}
      <div className="stat-cards">
        <StatCard label="🎯 Target (Quoted)" value={stats.target} sub={`${(data.quotations || []).length} quotations`} className="card-blue" icon="🎯" />
        <StatCard label="✅ Recovery (Paid)" value={stats.recovery} sub="Payments received" className="card-green" icon="✅" />
        <StatCard label="⚠️ Outstanding" value={stats.outstanding} sub="Pending payments" className="card-red" icon="⚠️" />
        <StatCard label="📦 Inventory Items" value={(data.inventory || []).length} sub="Active SKUs" className="card-purple" icon="📦" />
      </div>

      {/* Wallet Cards */}
      <div className="wallet-cards">
        <WalletCard icon="💵" name="Cash" amount={data.wallets?.cash} color="var(--green)" />
        <WalletCard icon="🏦" name="Bank" amount={data.wallets?.bank} color="var(--blue)" />
        <WalletCard icon="📱" name="JazzCash" amount={data.wallets?.jazzcash} color="var(--amber)" />
        <WalletCard icon="🟢" name="EasyPaisa" amount={data.wallets?.easypaisa} color="var(--green)" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="section-box">
          <div className="section-title">📈 Monthly Performance</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="inv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--red)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--red)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="rec" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--green)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--green)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: 'var(--bg3)', border: '1px solid var(--glass-border)', borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="var(--red)" fill="url(#inv)" strokeWidth={2} />
              <Area type="monotone" dataKey="recovered" name="Recovered" stroke="var(--green)" fill="url(#rec)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="section-box">
          <div className="section-title">📋 Quick Stats</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'Active Clients', val: (data.users?.clients || []).length, color: 'var(--green)' },
              { label: 'Employees', val: (data.users?.employees || []).length, color: 'var(--blue)' },
              { label: 'Pending Orders', val: (data.supplyOrders || []).filter(s => s.status === 'pending').length, color: 'var(--amber)' },
              { label: 'Client Requests', val: (data.quotations || []).filter(q => q.source === 'client').length, color: 'var(--purple)' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 13 }}>{item.label}</span>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Orbitron, sans-serif', color: item.color }}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="section-box">
        <div className="section-title">🕐 Recent Activity</div>
        {recentDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>
            No documents yet. Start by creating a quotation.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Number</th>
                  <th>Client</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentDocs.map(doc => (
                  <tr key={doc.id}>
                    <td>{doc.icon} {doc.type}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{doc.number || '—'}</td>
                    <td>{doc.clientName || '—'}</td>
                    <td className="text-green">PKR {Number(doc.total || 0).toLocaleString()}</td>
                    <td><span className={`badge badge-${doc.status || 'draft'}`}>{doc.status || 'Draft'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
