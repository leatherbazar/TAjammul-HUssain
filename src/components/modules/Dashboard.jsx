import React, { useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate } from '../../utils/fmt'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'
import toast from 'react-hot-toast'
import UniversalPaymentModal from '../common/UniversalPaymentModal'

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

// ─── Invoice Picker Modal (step 1 of Dashboard payment recovery) ──────────────
function InvoicePickerModal({ invoices, onSelect, onClose }) {
  const outstanding = invoices.filter(i => i.status !== 'paid' && i.status !== 'cancelled')
  const [selected, setSelected] = useState('')
  const inv = outstanding.find(i => i.id === selected)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">📥 Recover Payment — Select Invoice</div>
        {outstanding.length === 0 ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--green)', fontSize: 13 }}>✅ All invoices are paid!</div>
        ) : (
          <>
            <div className="input-group" style={{ marginBottom: 14 }}>
              <label className="input-label">Outstanding Invoice *</label>
              <select className="input" value={selected} onChange={e => setSelected(e.target.value)}>
                <option value="">— Choose invoice —</option>
                {outstanding.map(i => {
                  const bal = (i.total || 0) - (i.advancePaid || 0)
                  return <option key={i.id} value={i.id}>{i.number} | {i.clientName} | Balance: PKR {bal.toLocaleString()}</option>
                })}
              </select>
            </div>
            {inv && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)', marginBottom: 14, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Invoice Total</span><strong>PKR {Number(inv.total||0).toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ color: 'var(--text-muted)' }}>Already Paid</span><strong style={{ color: 'var(--green)' }}>PKR {Number(inv.advancePaid||0).toLocaleString()}</strong></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--glass-border)', paddingTop: 6 }}><strong>Balance Due</strong><strong style={{ color: 'var(--red)', fontFamily: 'monospace' }}>PKR {((inv.total||0)-(inv.advancePaid||0)).toLocaleString()}</strong></div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary w-full" disabled={!selected} onClick={() => onSelect(inv)}>Continue →</button>
            </div>
          </>
        )}
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
  const [recoverPicker, setRecoverPicker] = useState(false)  // step 1: pick invoice
  const [recoverInvoice, setRecoverInvoice] = useState(null) // step 2: pay selected invoice
  const [dayFilter, setDayFilter] = useState(() => new Date().toISOString().slice(0, 10))

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

    // ── Gross Profit = sum of per-sale profit (salePrice − costPrice × qty)
    const allSales = data.sales || []
    const totalProfit = allSales.reduce((s, x) => s + (x.totalProfit || 0), 0)
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

    // ── AP from purchases (per-company — what we still owe suppliers)
    const totalAP = purchases
      .filter(p => p.paymentStatus !== 'paid')
      .reduce((s, p) => s + Math.max((p.totalAmount || 0) - (p.paidAmount || 0), 0), 0)

    // ── Cash Position = DayBook net (type-based, matches Finance module wallet logic)
    const IN_TYPES  = new Set(['income', 'advance-received'])
    const OUT_TYPES = new Set(['expense', 'advance-given'])
    let dbIncome = 0, dbExpenses = 0
    for (const e of dayBook) {
      const amt = (parseFloat(e.debit) || 0) + (parseFloat(e.credit) || 0) + (parseFloat(e.amount) || 0)
      const t = (e.type || '').toLowerCase()
      if (IN_TYPES.has(t))  dbIncome   += amt
      if (OUT_TYPES.has(t)) dbExpenses += amt
    }
    const cash = dbIncome - dbExpenses

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
      const income  = entries.filter(e => ['income','advance-received'].includes((e.type||'').toLowerCase())).reduce((s, e) => s + (parseFloat(e.debit)||0) + (parseFloat(e.credit)||0) + (parseFloat(e.amount)||0), 0)
      const expense = entries.filter(e => ['expense','advance-given'].includes((e.type||'').toLowerCase())).reduce((s, e) => s + (parseFloat(e.debit)||0) + (parseFloat(e.credit)||0) + (parseFloat(e.amount)||0), 0)
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

  // ── Today's DayBook activity ───────────────────────────────────────────────
  const IN_T  = new Set(['income', 'advance-received'])
  const OUT_T = new Set(['expense', 'advance-given'])
  const todayEntries = useMemo(() => {
    return [...(data.dayBook || [])]
      .filter(e => (e.date || '').slice(0, 10) === dayFilter)
      .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
  }, [data.dayBook, dayFilter])

  const todayTotals = useMemo(() => {
    let income = 0, expense = 0
    for (const e of todayEntries) {
      const amt = (parseFloat(e.debit)||0) + (parseFloat(e.credit)||0) + (parseFloat(e.amount)||0)
      const t = (e.type||'').toLowerCase()
      if (IN_T.has(t))  income  += amt
      if (OUT_T.has(t)) expense += amt
    }
    return { income, expense, net: income - expense }
  }, [todayEntries])

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

  // ── Dynamic wallet balances — calculated from DayBook entries in real-time ───
  const walletBalances = useMemo(() => {
    const db = data.dayBook || []
    const names = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa', 'Cheque']
    const result = {}
    names.forEach(w => {
      const key = w.toLowerCase().replace(/\s+/g, '')
      const inflow  = db.filter(e => e.type === 'income'  && (e.wallet || 'Cash').toLowerCase().replace(/\s+/g, '') === key)
                        .reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
      const outflow = db.filter(e => e.type === 'expense' && (e.wallet || 'Cash').toLowerCase().replace(/\s+/g, '') === key)
                        .reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
      result[key] = inflow - outflow
    })
    return result
  }, [data.dayBook])

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
          action={{ label: '📥 Recover Payment', onClick: () => setRecoverPicker(true) }} />
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
                  PKR {Number(walletBalances[w.key] || 0).toLocaleString()}
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

      {/* ── Daily Activity ── */}
      <div className="section-box" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="section-title" style={{ margin: 0 }}>📒 Daily Cash Flow</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Date:</span>
            <input type="date" className="input" style={{ maxWidth: 160, padding: '5px 10px', fontSize: 13 }}
              value={dayFilter} onChange={e => setDayFilter(e.target.value)} />
          </div>
        </div>

        {/* Today's summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Money In</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--green)', fontFamily: 'Orbitron,monospace' }}>PKR {todayTotals.income.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Money Out</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--red)', fontFamily: 'Orbitron,monospace' }}>PKR {todayTotals.expense.toLocaleString()}</div>
          </div>
          <div style={{ background: todayTotals.net >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(220,38,38,0.08)', border: `1px solid ${todayTotals.net >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)'}`, borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Net</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: todayTotals.net >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'Orbitron,monospace' }}>PKR {todayTotals.net.toLocaleString()}</div>
          </div>
        </div>

        {todayEntries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
            No entries for this date. Go to Finance → Day Book to add entries.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Party</th>
                  <th>Wallet</th>
                  <th className="text-green">Money IN</th>
                  <th className="text-red">Money OUT</th>
                </tr>
              </thead>
              <tbody>
                {todayEntries.map((e, i) => {
                  const amt = (parseFloat(e.debit)||0) + (parseFloat(e.credit)||0) + (parseFloat(e.amount)||0)
                  const t = (e.type||'').toLowerCase()
                  const isIn  = IN_T.has(t)
                  const isOut = OUT_T.has(t)
                  return (
                    <tr key={e.id || i}>
                      <td>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 700, textTransform: 'capitalize',
                          background: isIn ? 'rgba(34,197,94,0.15)' : isOut ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)',
                          color:      isIn ? 'var(--green)'         : isOut ? 'var(--red)'           : 'var(--blue)',
                        }}>{e.type}</span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.category || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{e.description || '—'}</td>
                      <td style={{ fontSize: 12 }}>
                        {e.partyName ? <div><div style={{ fontWeight: 600 }}>{e.partyName}</div>{e.accountHeadID && <div style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'monospace' }}>{e.accountHeadID}</div>}</div> : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>{e.wallet || '—'}</td>
                      <td className="text-green bold">{isIn  ? `PKR ${amt.toLocaleString()}` : '—'}</td>
                      <td className="text-red bold">{isOut ? `PKR ${amt.toLocaleString()}` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Step 1: Pick invoice ── */}
      {recoverPicker && (
        <InvoicePickerModal
          invoices={data.invoices || []}
          onClose={() => setRecoverPicker(false)}
          onSelect={inv => { setRecoverPicker(false); setRecoverInvoice(inv) }}
        />
      )}
      {/* ── Step 2: Universal payment with WHT ── */}
      {recoverInvoice && (
        <UniversalPaymentModal
          direction="inbound"
          docNumber={recoverInvoice.number}
          partyName={recoverInvoice.clientName}
          total={recoverInvoice.total || 0}
          alreadyPaid={recoverInvoice.advancePaid || 0}
          apiEndpoint={`/api/invoices/${recoverInvoice.id}/payment`}
          onClose={() => setRecoverInvoice(null)}
          onSuccess={async () => { setRecoverInvoice(null); await refreshData() }}
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
