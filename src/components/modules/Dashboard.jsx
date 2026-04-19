import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import toast from 'react-hot-toast'

const WALLETS_LIST = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa']

// ─── Mini KPI Card ────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon, isMoney = true, action }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14,
      background: 'var(--glass)', border: `1px solid ${color}44`,
      display: 'flex', flexDirection: 'column', gap: 4, position: 'relative',
    }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, monospace', color }}>
        {isMoney ? `PKR ${Number(value || 0).toLocaleString()}` : Number(value || 0).toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
      {action && (
        <button
          onClick={action.onClick}
          style={{
            marginTop: 8, padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: `${color}22`, border: `1px solid ${color}66`, color,
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

// ─── Recover Payment Modal ────────────────────────────────────────────────────
function RecoverModal({ invoices, onClose, onSuccess }) {
  const [selected, setSelected]   = useState(null)
  const [amount, setAmount]       = useState('')
  const [wallet, setWallet]       = useState('Cash')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving]       = useState(false)

  const outstanding = invoices.filter(i => i.status !== 'paid')
  const inv = outstanding.find(i => i.id === selected)
  const balance = inv ? (inv.total || 0) - (inv.advancePaid || 0) : 0

  const handleRecover = async () => {
    if (!selected) { toast.error('Select an invoice first.'); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount.'); return }
    if (amt > balance + 0.01) { toast.error(`Amount exceeds balance of PKR ${balance.toLocaleString()}`); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${selected}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, wallet, date }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); return }
      toast.success(`PKR ${amt.toLocaleString()} recovered! Invoice ${data.status === 'paid' ? '✅ fully paid' : '⏳ partial'}.`)
      onSuccess()
    } catch {
      toast.error('Connection error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">📥 Record Payment Recovery</div>

        {/* Invoice picker */}
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Select Outstanding Invoice *</label>
          {outstanding.length === 0 ? (
            <div style={{ padding: 12, borderRadius: 8, background: 'rgba(34,197,94,0.1)', color: 'var(--green)', fontSize: 13, textAlign: 'center' }}>
              ✅ All invoices are paid!
            </div>
          ) : (
            <select className="input" value={selected || ''} onChange={e => { setSelected(e.target.value); setAmount('') }}>
              <option value="">— Choose invoice —</option>
              {outstanding.map(i => {
                const bal = (i.total || 0) - (i.advancePaid || 0)
                return (
                  <option key={i.id} value={i.id}>
                    {i.number} | {i.clientName || 'Client'} | Balance: PKR {bal.toLocaleString()}
                  </option>
                )
              })}
            </select>
          )}
        </div>

        {/* Selected invoice summary */}
        {inv && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', marginBottom: 12, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Invoice Total</span>
              <span style={{ fontWeight: 700 }}>PKR {Number(inv.total || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Already Paid</span>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>PKR {Number(inv.advancePaid || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: 6 }}>
              <span style={{ fontWeight: 700 }}>Balance Due</span>
              <span style={{ color: 'var(--red)', fontWeight: 900, fontFamily: 'monospace' }}>PKR {balance.toLocaleString()}</span>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Amount Received (PKR) *</label>
            <input type="number" className="input" min="1" max={balance} value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00"
              style={{ borderColor: amount ? 'var(--green)' : undefined }} />
            {inv && amount && (
              <div style={{ fontSize: 11, marginTop: 3, color: parseFloat(amount) >= balance ? 'var(--green)' : 'var(--amber)' }}>
                {parseFloat(amount) >= balance ? '✅ Full payment' : `Remaining after: PKR ${(balance - parseFloat(amount)).toLocaleString()}`}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Received In</label>
            <select className="input" value={wallet} onChange={e => setWallet(e.target.value)}>
              {WALLETS_LIST.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-full" onClick={handleRecover} disabled={saving || outstanding.length === 0}>
            {saving ? 'Saving...' : '📥 Record Recovery'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Custom Chart Tooltip ─────────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: PKR {Number(p.value || 0).toLocaleString()}
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { data, refreshData } = useApp()
  const [showRecover, setShowRecover] = useState(false)

  // ── Financial computations ─────────────────────────────────────────────────
  const fin = useMemo(() => {
    const invoices  = data.invoices  || []
    const purchases = data.purchases || []
    const dayBook   = data.dayBook   || []
    const contacts  = data.contacts  || []

    // ── Revenue: total of all active invoices (not cancelled)
    const totalRevenue   = invoices
      .filter(i => i.status !== 'cancelled')
      .reduce((s, i) => s + (i.total || 0), 0)

    // ── Purchases
    const totalPurchased = purchases.reduce((s, x) => s + (x.totalAmount || 0), 0)

    // ── Gross Profit = Revenue billed − cost of purchases
    const totalProfit = totalRevenue - totalPurchased
    const profitPct   = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0'

    // ── Payments actually received (advancePaid across ALL invoices, any status)
    const invoicePaid = invoices.reduce((s, i) => s + (i.advancePaid || 0), 0)
    const paidCount   = invoices.filter(i => i.status === 'paid').length
    const partialCount = invoices.filter(i => i.status === 'partial').length

    // ── Outstanding = what clients still owe us
    const invoiceOutstanding = invoices
      .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
      .reduce((s, i) => s + Math.max((i.total || 0) - (i.advancePaid || 0), 0), 0)

    // ── AR directly from invoices (most accurate — doesn't depend on ledger entries)
    const totalAR = invoiceOutstanding

    // ── AP from supplier contacts (ledger-backed)
    const totalAP = contacts
      .filter(c => c.type === 'supplier')
      .reduce((s, c) => s + Math.abs(c.currentBalance || 0), 0)

    // ── Cash Position = DayBook net (income received − expenses paid)
    const dbIncome   = dayBook.filter(e => e.type === 'income' ).reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
    const dbExpenses = dayBook.filter(e => e.type === 'expense').reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
    const cash = Math.max(dbIncome - dbExpenses, 0)

    return {
      totalRevenue, totalProfit, profitPct, totalPurchased,
      invoicePaid, invoiceOutstanding, paidCount, partialCount,
      totalAR, totalAP, dbIncome, dbExpenses, cash,
    }
  }, [data])

  // ── Monthly DayBook Income vs Expense ─────────────────────────────────────
  const dbChart = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const year = new Date().getFullYear()
    return months.map((month, idx) => {
      const entries = (data.dayBook || []).filter(e => {
        const d = new Date(e.date || e.createdAt)
        return d.getFullYear() === year && d.getMonth() === idx
      })
      const income  = entries.filter(e => e.type === 'income'  || e.category === 'Sale'    ).reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
      const expense = entries.filter(e => e.type === 'expense' || e.category === 'Purchase').reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
      return { month, income, expense }
    })
  }, [data.dayBook])

  // ── Monthly Sales Revenue vs Profit ───────────────────────────────────────
  const salesChart = useMemo(() => {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const year = new Date().getFullYear()
    return months.map((month, idx) => {
      const ms = (data.sales || []).filter(s => {
        const d = new Date(s.date || s.createdAt)
        return d.getFullYear() === year && d.getMonth() === idx
      })
      return {
        month,
        revenue: ms.reduce((s, x) => s + (x.total       || 0), 0),
        profit:  ms.reduce((s, x) => s + (x.totalProfit  || 0), 0),
      }
    })
  }, [data.sales])

  // ── Recent DayBook entries ─────────────────────────────────────────────────
  const recentDB = useMemo(() =>
    [...(data.dayBook || [])]
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      .slice(0, 8)
  , [data.dayBook])

  // ── Recent documents ──────────────────────────────────────────────────────
  const recentDocs = useMemo(() => {
    const all = [
      ...(data.quotations    || []).map(q => ({ ...q, _type: 'Quotation',     icon: '📋' })),
      ...(data.invoices      || []).map(i => ({ ...i, _type: 'Invoice',       icon: '🧾' })),
      ...(data.deliveryNotes || []).map(d => ({ ...d, _type: 'Delivery Note', icon: '🚚' })),
    ]
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6)
  }, [data])

  const walletCards = [
    { icon: '💵', name: 'Cash',      key: 'cash',      color: 'var(--green)'  },
    { icon: '🏦', name: 'Bank',      key: 'bank',      color: 'var(--blue)'   },
    { icon: '📱', name: 'JazzCash',  key: 'jazzcash',  color: 'var(--amber)'  },
    { icon: '🟢', name: 'EasyPaisa', key: 'easypaisa', color: 'var(--purple)' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📊 <span>Dashboard</span></h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* ── Row 1: Primary financial KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        <KpiCard label="Total Revenue"   value={fin.totalRevenue}   sub={`${(data.invoices||[]).filter(i=>i.status!=='cancelled').length} invoices`}  color="var(--green)"  icon="💰" />
        <KpiCard label="Gross Profit"    value={fin.totalProfit}    sub={`${fin.profitPct}% margin (Rev − Purchases)`}                               color={fin.totalProfit>=0?'var(--blue)':'var(--red)'}  icon="📈" />
        <KpiCard label="Total Purchases" value={fin.totalPurchased} sub={`${(data.purchases||[]).length} purchase orders`}                           color="var(--amber)"  icon="🛒" />
        <KpiCard label="Cash Position"   value={fin.cash}           sub={`Income PKR ${fin.dbIncome.toLocaleString()} − Exp PKR ${fin.dbExpenses.toLocaleString()}`} color="var(--purple)" icon="🏦" />
      </div>

      {/* ── Row 2: AR / AP / Invoices ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }}>
        <KpiCard label="Accounts Receivable" value={fin.totalAR}            sub={`From ${(data.invoices||[]).filter(i=>i.status!=='paid'&&i.status!=='cancelled').length} unpaid invoices`} color="var(--green)"  icon="📥" />
        <KpiCard label="Accounts Payable"    value={fin.totalAP}            sub={`${(data.contacts||[]).filter(c=>c.type==='supplier').length} suppliers`}                                  color="var(--red)"    icon="📤" />
        <KpiCard label="Invoice Outstanding" value={fin.invoiceOutstanding}  sub={`${(data.invoices||[]).filter(i=>i.status!=='paid'&&i.status!=='cancelled').length} pending`}             color="var(--amber)"  icon="⚠️" />
        <KpiCard label="Invoice Recovered"   value={fin.invoicePaid}         sub={`${fin.paidCount} paid · ${fin.partialCount} partial`}                                                    color="var(--green)"  icon="✅"
          action={{ label: '📥 Recover Payment', onClick: () => setShowRecover(true) }} />
      </div>

      {/* ── Wallets ── */}
      <div style={{ marginBottom: 18 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>👛 Wallets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {walletCards.map(w => (
            <div key={w.key} style={{ padding: '12px 16px', borderRadius: 12, background: 'var(--glass)', border: `1px solid ${w.color}33`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>{w.icon}</span>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{w.name}</div>
                <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: w.color }}>
                  PKR {Number((data.wallets||{})[w.key] || 0).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Charts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Day Book: Income vs Expense */}
        <div className="section-box" style={{ margin: 0 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>📒 Day Book — Income vs Expense ({new Date().getFullYear()})</div>
          {(data.dayBook||[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No day book entries yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dbChart} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income"  name="Income"  fill="#22c55e" radius={[3,3,0,0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Sales: Revenue vs Profit */}
        <div className="section-box" style={{ margin: 0 }}>
          <div className="section-title" style={{ marginBottom: 14 }}>📈 Sales — Revenue vs Profit ({new Date().getFullYear()})</div>
          {(data.sales||[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>No sales data yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={salesChart} margin={{ top: 0, right: 8, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                  </linearGradient>
                  <linearGradient id="gPro" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}   />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#3b82f6" fill="url(#gRev)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit"  name="Profit"  stroke="#22c55e" fill="url(#gPro)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div style={{ marginBottom: 18 }}>
        <div className="section-title" style={{ marginBottom: 10 }}>📋 Quick Stats</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
          {[
            { label: 'Active Clients', val: (data.users?.clients   || []).length,                                     color: 'var(--green)',  icon: '🤝' },
            { label: 'Employees',      val: (data.users?.employees || []).length,                                     color: 'var(--blue)',   icon: '👷' },
            { label: 'Pending Orders', val: (data.supplyOrders     || []).filter(s => s.status === 'pending').length, color: 'var(--amber)', icon: '🛒' },
            { label: 'Inventory SKUs', val: (data.inventory        || []).length,                                     color: 'var(--purple)', icon: '📦' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 8px', borderRadius: 12, background: 'var(--glass)', border: `1px solid ${item.color}44`, gap: 4 }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Orbitron, sans-serif', color: item.color }}>{item.val}</span>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent Day Book Entries ── */}
      <div className="section-box" style={{ marginBottom: 20 }}>
        <div className="section-title">📒 Recent Day Book Entries</div>
        {recentDB.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            No day book entries yet. Go to Finance → Day Book to add entries.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Party</th>
                  <th>Wallet</th>
                  <th className="text-red">Debit (Dr)</th>
                  <th className="text-green">Credit (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {recentDB.map((e, i) => (
                  <tr key={e.id || i}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'capitalize',
                        background: e.type === 'income' ? 'rgba(34,197,94,0.15)' : e.type === 'expense' ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)',
                        color:      e.type === 'income' ? 'var(--green)'         : e.type === 'expense' ? 'var(--red)'           : 'var(--blue)',
                      }}>{e.type}</span>
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.category || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{e.description || '—'}</td>
                    <td style={{ fontSize: 12 }}>
                      {e.partyName ? (
                        <div>
                          <div style={{ fontWeight: 600 }}>{e.partyName}</div>
                          {e.accountHeadID && <div style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'monospace' }}>{e.accountHeadID}</div>}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ fontSize: 12 }}>{e.wallet || '—'}</td>
                    <td className="text-red bold">{e.debit ? `PKR ${Number(e.debit).toLocaleString()}` : '—'}</td>
                    <td className="text-green bold">{e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recover Modal ── */}
      {showRecover && (
        <RecoverModal
          invoices={data.invoices || []}
          onClose={() => setShowRecover(false)}
          onSuccess={async () => { setShowRecover(false); await refreshData() }}
        />
      )}

      {/* ── Recent Documents ── */}
      <div className="section-box">
        <div className="section-title">🕐 Recent Documents</div>
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
                {recentDocs.map((doc, i) => (
                  <tr key={doc.id || i}>
                    <td>{doc.icon} {doc._type}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{doc.number || '—'}</td>
                    <td>{doc.clientName || '—'}</td>
                    <td className="text-green bold">PKR {Number(doc.total || 0).toLocaleString()}</td>
                    <td><span className={`badge badge-${doc.status || 'draft'}`}>{doc.status || 'Draft'}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '—'}
                    </td>
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
