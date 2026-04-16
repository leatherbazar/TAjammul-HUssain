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


      {/* Quick Stats — 2×2 half-size cards */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-title" style={{ marginBottom: 12 }}>📋 Quick Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Active Clients', val: (data.users?.clients || []).length, color: 'var(--green)', icon: '🤝' },
            { label: 'Employees', val: (data.users?.employees || []).length, color: 'var(--blue)', icon: '👷' },
            { label: 'Pending Orders', val: (data.supplyOrders || []).filter(s => s.status === 'pending').length, color: 'var(--amber)', icon: '🛒' },
            { label: 'Client Requests', val: (data.quotations || []).filter(q => q.source === 'client').length, color: 'var(--purple)', icon: '📋' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 8px', borderRadius: 10, background: 'var(--glass)', border: `1px solid ${item.color}44`, gap: 4 }}>
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Orbitron, sans-serif', color: item.color }}>{item.val}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{item.label}</span>
            </div>
          ))}
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
