import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import { exportQuotationPDF } from '../../utils/pdfExport'
import { exportQuotationExcel } from '../../utils/excelExport'
import toast from 'react-hot-toast'

// Translate internal status → client-facing label + style
function clientStatusBadge(status) {
  if (status === 'approved')
    return <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--green)', whiteSpace: 'nowrap' }}>✅ Approved</span>
  if (status === 'cancelled')
    return <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: 'var(--red)', whiteSpace: 'nowrap' }}>❌ Rejected</span>
  return <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: 'var(--amber)', whiteSpace: 'nowrap' }}>⏳ Pending Review</span>
}

function ClientDashboard({ user }) {
  const { data } = useApp()
  const myQuotations = (data.quotations || []).filter(q => q.clientId === user.id || q.clientName === user.name)
  const myInvoices = (data.invoices || []).filter(i => i.clientId === user.id || i.clientName === user.name)

  const totalOrdered = myQuotations.reduce((s, q) => s + (q.total || 0), 0)
  const totalPaid = myInvoices.reduce((s, i) => s + (i.advancePaid || 0), 0)
  const outstanding = myInvoices.reduce((s, i) => s + ((i.total || 0) - (i.advancePaid || 0)), 0)

  return (
    <div>
      <div style={{ padding: '20px 0 10px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 800 }}>Welcome, <span style={{ color: 'var(--green)' }}>{user.name}</span> 👋</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{user.company && `${user.company} • `}{user.phone}</p>
      </div>

      <div className="stat-cards">
        <div className="stat-card card-blue"><div className="label">🎯 Total Ordered</div><div className="value" style={{ fontSize: 18 }}>PKR {totalOrdered.toLocaleString()}</div><div className="sub">{myQuotations.length} requests</div></div>
        <div className="stat-card card-green"><div className="label">✅ Total Paid</div><div className="value" style={{ fontSize: 18 }}>PKR {totalPaid.toLocaleString()}</div></div>
        <div className="stat-card card-red"><div className="label">⏳ Outstanding</div><div className="value" style={{ fontSize: 18 }}>PKR {outstanding.toLocaleString()}</div></div>
      </div>

      <div className="section-box">
        <div className="section-title">📋 My Recent Requests</div>
        {myQuotations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 13 }}>No requests yet. Submit your first requirement.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Items</th><th>Target Price</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {[...myQuotations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(q => (
                  <tr key={q.id}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{q.number}</td>
                    <td style={{ fontSize: 12 }}>{q.date}</td>
                    <td>{(q.items || []).length} item(s)</td>
                    <td className="text-green bold">PKR {Number(q.total || 0).toLocaleString()}</td>
                    <td>{clientStatusBadge(q.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationPDF(q, true)}>📄 PDF</button>
                        <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationExcel(q)}>📊 Excel</button>
                      </div>
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

function NewRequestForm({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    items: [{ id: Date.now(), description: '', color: '', useMatrix: false, matrixRows: [], qty: 1, targetPrice: 0 }],
    notes: '',
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), description: '', color: '', useMatrix: false, matrixRows: [], qty: 1, targetPrice: 0 }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  const updateMatrix = (id, rows) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))

  const total = form.items.reduce((s, item) => {
    const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
    return s + qty * (parseFloat(item.targetPrice) || 0)
  }, 0)

  return (
    <div>
      <div className="section-box">
        <div className="section-title">📋 My Requirements</div>
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 14, fontSize: 13, color: 'var(--text-muted)' }}>
          ℹ️ Enter your item requirements and target prices. Our team will review and get back to you.
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
        </div>

        {form.items.map((item, idx) => {
          const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
          const amount = qty * (parseFloat(item.targetPrice) || 0)
          return (
            <div key={item.id} style={{ marginBottom: 12, padding: 14, borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Item #{idx + 1} Description *</label>
                  <input className="input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="e.g. Men's Winter Jacket, Black, Size M-XL" spellCheck />
                </div>
                <div className="input-group">
                  <label className="input-label">Color (if single)</label>
                  <input className="input" value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} disabled={item.useMatrix} />
                </div>
                <div className="input-group">
                  <label className="input-label">Quantity {item.useMatrix ? '(auto)' : ''}</label>
                  <input type="number" className="input" min="0" value={item.useMatrix ? qty : item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} disabled={item.useMatrix} />
                </div>
                <div className="input-group">
                  <label className="input-label">Target Price / Unit (PKR)</label>
                  <input type="number" className="input" min="0" value={item.targetPrice} onChange={e => updateItem(item.id, 'targetPrice', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>Amount</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>PKR {amount.toLocaleString()}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <button className={`btn btn-sm ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`} onClick={() => updateItem(item.id, 'useMatrix', !item.useMatrix)}>
                    🎨 {item.useMatrix ? 'Simple' : 'Size/Color'}
                  </button>
                  {form.items.length > 1 && (
                    <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button>
                  )}
                </div>
              </div>
              {item.useMatrix && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>🎨 Size & Color Breakdown</div>
                  <AttributeMatrix rows={item.matrixRows} onChange={rows => updateMatrix(item.id, rows)} />
                </div>
              )}
            </div>
          )
        })}
        <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Another Item</button>

        <div className="divider" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 14 }}>Total Target Value:</span>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: 'var(--green)' }}>PKR {total.toLocaleString()}</span>
        </div>

        <div className="input-group" style={{ marginTop: 12 }}>
          <label className="input-label">Additional Notes / Specifications</label>
          <textarea className="input" rows={3} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Quality requirements, delivery timeline, preferred brands..." spellCheck />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          const hasItems = form.items.some(i => i.description)
          if (!hasItems) { toast.error('Add at least one item.'); return }
          onSave({ ...form, total, clientName: user.name, clientId: user.id, clientContact: user.phone, source: 'client' })
        }}>📤 Submit Request</button>
      </div>
    </div>
  )
}

export default function ClientPortal() {
  const { currentUser, addRecord, data } = useApp()
  const [tab, setTab] = useState('dashboard')

  const myQuotations = useMemo(() =>
    (data.quotations || []).filter(q => q.clientId === currentUser?.id || q.clientName === currentUser?.name),
    [data.quotations, currentUser]
  )
  const myInvoices = useMemo(() =>
    (data.invoices || []).filter(i => i.clientId === currentUser?.id || i.clientName === currentUser?.name),
    [data.invoices, currentUser]
  )

  const handleSubmitRequest = (formData) => {
    const num = `REQ-${Date.now().toString().slice(-5)}`
    addRecord('quotations', { ...formData, number: num, status: 'draft' })
    toast.success('Request submitted! Our team will review it shortly.')
    setTab('my-requests')
  }

  return (
    <div className="fade-in">
      <div className="tabs">
        {[['dashboard', '📊 Overview'], ['new-request', '➕ New Request'], ['my-requests', '📋 My Requests'], ['my-invoices', '🧾 My Invoices']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'dashboard' && <ClientDashboard user={currentUser} />}

      {tab === 'new-request' && (
        <NewRequestForm user={currentUser} onSave={handleSubmitRequest} onCancel={() => setTab('dashboard')} />
      )}

      {tab === 'my-requests' && (
        <div>
          <div className="page-header"><h2>📋 <span>My Requests</span></h2></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Date</th><th>Items</th><th>Target Value</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {myQuotations.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No requests submitted yet.</td></tr>}
                {[...myQuotations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(q => (
                  <tr key={q.id}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{q.number}</td>
                    <td style={{ fontSize: 12 }}>{q.date}</td>
                    <td>{(q.items || []).length} item(s)</td>
                    <td className="text-green bold">PKR {Number(q.total || 0).toLocaleString()}</td>
                    <td>{clientStatusBadge(q.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationPDF(q, true)}>📄 PDF</button>
                        <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationExcel(q)}>📊 Excel</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'my-invoices' && (
        <div>
          <div className="page-header"><h2>🧾 <span>My Invoices</span></h2></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
              <tbody>
                {myInvoices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No invoices yet.</td></tr>}
                {myInvoices.map(inv => {
                  const bal = (inv.total || 0) - (inv.advancePaid || 0)
                  return (
                    <tr key={inv.id}>
                      <td className="font-mono" style={{ color: 'var(--red)', fontSize: 12 }}>{inv.number}</td>
                      <td style={{ fontSize: 12 }}>{inv.date}</td>
                      <td className="bold">PKR {Number(inv.total || 0).toLocaleString()}</td>
                      <td className="text-green">PKR {Number(inv.advancePaid || 0).toLocaleString()}</td>
                      <td className={bal > 0 ? 'text-red bold' : 'text-green bold'}>PKR {bal.toLocaleString()}</td>
                      <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
