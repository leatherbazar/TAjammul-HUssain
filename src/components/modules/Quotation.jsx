import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import { calcExpr } from '../../utils/calcExpr'
import ContactSelect from '../common/ContactSelect'
import { exportQuotationPDF } from '../../utils/pdfExport'
import { exportQuotationExcel } from '../../utils/excelExport'
import toast from 'react-hot-toast'

const EMPTY_ITEM = () => ({ id: Date.now(), description: '', color: '', qty: 1, unitPrice: 0, useMatrix: false, matrixRows: [] })
const TAX_OPTIONS = [{ label: '0%', val: 0 }, { label: '5.5%', val: 5.5 }, { label: '15%', val: 15 }, { label: '18%', val: 18 }, { label: 'Custom', val: -1 }]

function QuotationForm({ initial, onSave, onCancel, clients }) {
  const { data } = useApp()
  const [form, setForm] = useState(initial || {
    clientName: '', clientContact: '', clientId: '',
    date: new Date().toISOString().slice(0, 10),
    items: [EMPTY_ITEM()],
    taxRate: 0, customTax: '', notes: '',
    stealthPrint: false, status: 'draft',
  })
  const [expandedRows, setExpandedRows] = useState({})

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, EMPTY_ITEM()] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  const updateMatrix = (id, rows) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))

  const effectiveTaxRate = form.taxRate === -1 ? (parseFloat(form.customTax) || 0) : form.taxRate
  const subtotal = form.items.reduce((s, item) => {
    const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
    return s + qty * (parseFloat(item.unitPrice) || 0)
  }, 0)
  const taxAmount = subtotal * effectiveTaxRate / 100
  const total = subtotal + taxAmount

  const handleSave = (status, goToInvoice = false) => {
    if (!form.clientName) { toast.error('Client name is required.'); return }
    onSave({ ...form, status, subtotal, taxAmount, total, taxRate: effectiveTaxRate }, goToInvoice)
  }

  return (
    <div>
      {/* Client Info */}
      <div className="section-box">
        <div className="section-title">👤 Client Information</div>
        <div className="form-grid form-grid-3">
          <div className="input-group">
            <label className="input-label">Client Name *</label>
            <ContactSelect
              type="client"
              value={form.clientName}
              onChange={(name) => setField('clientName', name)}
              onContactSelect={(c) => setField('clientContact', c.phone || form.clientContact)}
              placeholder="Select or type client..."
            />
          </div>
          <div className="input-group">
            <label className="input-label">Contact</label>
            <input className="input" placeholder="+92..." value={form.clientContact} onChange={e => setField('clientContact', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group col-span-3">
            <label className="input-label">Notes / Terms</label>
            <textarea className="input" placeholder="Payment terms, delivery info..." value={form.notes} onChange={e => setField('notes', e.target.value)} spellCheck rows={2} />
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="section-box">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span>📦 Items</span>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
        </div>

        {form.items.map((item, idx) => {
          const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
          const amount = qty * (parseFloat(item.unitPrice) || 0)

          return (
            <div key={item.id} style={{ marginBottom: 16, padding: 14, borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid" style={{ marginBottom: item.useMatrix ? 12 : 0 }}>
                <div className="input-group" style={{ gridColumn: 'span 3' }}>
                  <label className="input-label">Description #{idx + 1}</label>
                  <input className="input" placeholder="Item description..." value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)} spellCheck />
                </div>
                <div className="input-group">
                  <label className="input-label">Color (if single)</label>
                  <input className="input" placeholder="e.g. Black" value={item.color}
                    onChange={e => updateItem(item.id, 'color', e.target.value)} disabled={item.useMatrix} />
                </div>
                <div className="input-group">
                  <label className="input-label">Qty {item.useMatrix ? '(auto)' : '✏️ e.g. 10+5'}</label>
                  <input type="text" inputMode="decimal" className="input" placeholder="0"
                    value={item.useMatrix ? qty : item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    onBlur={e => updateItem(item.id, 'qty', calcExpr(e.target.value))}
                    disabled={item.useMatrix} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit Price (PKR) ✏️ e.g. 100-25</label>
                  <input type="text" inputMode="decimal" className="input" placeholder="0.00"
                    value={item.unitPrice}
                    onChange={e => updateItem(item.id, 'unitPrice', e.target.value)}
                    onBlur={e => updateItem(item.id, 'unitPrice', calcExpr(e.target.value))} />
                </div>
                <div className="input-group" style={{ justifyContent: 'flex-end', alignItems: 'flex-end' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className={`btn btn-sm ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
                      onClick={() => {
                        updateItem(item.id, 'useMatrix', !item.useMatrix)
                        setExpandedRows(prev => ({ ...prev, [item.id]: !item.useMatrix }))
                      }}
                      title="Toggle size/color breakdown"
                    >
                      🎨 {item.useMatrix ? 'Hide Matrix' : 'Size/Color'}
                    </button>
                    {form.items.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button>
                    )}
                  </div>
                  <div style={{ marginTop: 6, textAlign: 'right', fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>
                    PKR {amount.toLocaleString()}
                  </div>
                </div>
              </div>

              {item.useMatrix && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>🎨 Size & Color Breakdown</div>
                  <AttributeMatrix rows={item.matrixRows} onChange={rows => updateMatrix(item.id, rows)} />
                </div>
              )}
            </div>
          )
        })}

        {/* Tax & Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ minWidth: 280 }}>
            <div style={{ marginBottom: 12 }}>
              <div className="input-label" style={{ marginBottom: 6 }}>Tax Rate</div>
              <div className="tax-btns">
                {TAX_OPTIONS.map(t => (
                  <button key={t.val} className={`tax-btn ${form.taxRate === t.val ? 'active' : ''}`}
                    onClick={() => setField('taxRate', t.val)}>
                    {t.label}
                  </button>
                ))}
              </div>
              {form.taxRate === -1 && (
                <input type="number" className="input" style={{ marginTop: 8, width: 100 }} placeholder="Rate %" value={form.customTax}
                  onChange={e => setField('customTax', e.target.value)} />
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12 }}>
              {[['Subtotal', subtotal], [`Tax (${effectiveTaxRate}%)`, taxAmount], ['TOTAL', total]].map(([label, val], i) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontWeight: i === 2 ? 800 : 400, fontSize: i === 2 ? 16 : 13, borderTop: i === 2 ? '1px solid var(--red)' : 'none', marginTop: i === 2 ? 6 : 0, color: i === 2 ? 'var(--green)' : 'var(--text)' }}>
                  <span>{label}</span>
                  <span>PKR {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="stealth" checked={form.stealthPrint} onChange={e => setField('stealthPrint', e.target.checked)} />
              <label htmlFor="stealth" style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                🥷 Stealth Print (hide totals/tax in PDF)
              </label>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-secondary" onClick={() => handleSave('draft')}>💾 Save Draft</button>
        <button className="btn btn-primary" onClick={() => handleSave('sent')}>📤 Send to Client</button>
        <button className="btn btn-success" onClick={() => handleSave('approved', true)}>✅ Approve → Invoice</button>
      </div>
    </div>
  )
}

export default function Quotations() {
  const { data, addRecord, updateRecord, deleteRecord, nextInvoiceNumber } = useApp()
  const navigate = useNavigate()
  const [view, setView] = useState('list') // list | new | edit | detail
  const [selected, setSelected] = useState(null)
  const [masterAction, setMasterAction] = useState(null) // {type, id}
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')

  // Unique client list from quotations for the dropdown
  const clientList = useMemo(() => {
    const names = [...new Set((data.quotations || []).map(q => q.clientName).filter(Boolean))].sort()
    return names
  }, [data.quotations])

  const quotations = useMemo(() => {
    let list = data.quotations || []
    if (search) list = list.filter(q => q.clientName?.toLowerCase().includes(search.toLowerCase()) || q.number?.includes(search))
    if (statusFilter !== 'all') list = list.filter(q => q.status === statusFilter)
    if (clientFilter !== 'all') list = list.filter(q => q.clientName === clientFilter)
    return list
  }, [data.quotations, search, statusFilter, clientFilter])

  const handleSave = (formData, goToInvoice = false) => {
    let savedRecord
    if (selected) {
      updateRecord('quotations', selected.id, formData)
      savedRecord = { ...selected, ...formData }
      toast.success('Quotation updated!')
    } else {
      const num = `QT-${Date.now().toString().slice(-5)}`
      savedRecord = { ...formData, number: num, id: Date.now().toString() }
      addRecord('quotations', savedRecord)
      toast.success('Quotation created!')
    }
    setView('list')
    setSelected(null)

    // "Approve → Invoice": navigate straight to invoice editor with data
    if (goToInvoice) {
      setTimeout(() => {
        sessionStorage.setItem('tat_convert_quote', JSON.stringify(savedRecord))
        navigate('/admin/invoices')
        toast('📋 Opening Invoice editor — all items are editable.', { duration: 4000 })
      }, 100)
    }
  }

  const requestDelete = (id) => setMasterAction({ type: 'delete', id })
  const confirmDelete = () => {
    deleteRecord('quotations', masterAction.id)
    toast.success('Quotation deleted.')
    setMasterAction(null)
  }

  const requestEdit = (q) => setMasterAction({ type: 'edit', q })
  const confirmEdit = () => {
    setSelected(masterAction.q)
    setView('edit')
    setMasterAction(null)
  }

  // Navigate to Invoices with the quotation pre-loaded for editable conversion
  const convertToInvoice = (q) => {
    // Store the quotation in sessionStorage so Invoice module can pick it up
    sessionStorage.setItem('tat_convert_quote', JSON.stringify(q))
    navigate('/admin/invoices')
    toast('📋 Quotation loaded — review items then save as Invoice.', { duration: 4000 })
  }

  if (view === 'new' || view === 'edit') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>📋 <span>{view === 'new' ? 'New Quotation' : 'Edit Quotation'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <QuotationForm initial={selected} onSave={handleSave} onCancel={() => { setView('list'); setSelected(null) }} clients={data.users?.clients || []} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📋 <span>Quotations</span></h2>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Quotation</button>
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="🔍 Search by client or number..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 200 }} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="all">👤 All Clients</option>
          {clientList.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          {['draft', 'sent', 'approved', 'invoiced', 'cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        {(clientFilter !== 'all' || statusFilter !== 'all') && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setClientFilter('all'); setStatusFilter('all'); setSearch('') }}>
            ✕ Clear
          </button>
        )}
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Client</th><th>Date</th><th>Items</th><th>Total</th><th>Tax</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No quotations found. Create your first one.</td></tr>
            )}
            {quotations.map(q => {
              // Find existing invoice for this quotation (by quotationId or quotationRef)
              const existingInv = (data.invoices || []).find(
                i => i.quotationId === q.id || i.quotationRef === q.number
              )
              return (
              <tr key={q.id}>
                <td className="font-mono" style={{ fontSize: 12 }}>{q.number}</td>
                <td><div style={{ fontWeight: 600 }}>{q.clientName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{q.clientContact}</div></td>
                <td style={{ fontSize: 12 }}>{q.date}</td>
                <td>{(q.items || []).length} item(s)</td>
                <td className="text-green bold">PKR {Number(q.total || 0).toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{q.taxRate}%</td>
                <td><span className={`badge badge-${q.status}`}>{q.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => requestEdit(q)}>✏️</button>
                    <button className="btn btn-danger btn-xs" onClick={() => requestDelete(q.id)}>🗑️</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationPDF(q, q.stealthPrint)}>📄</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => exportQuotationExcel(q)}>📊</button>
                    {existingInv ? (
                      // Invoice already exists — show the linked invoice number, no duplicate allowed
                      <span style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 700,
                        background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)',
                        color: 'var(--green)', whiteSpace: 'nowrap',
                      }}>
                        ✓ {existingInv.number}
                      </span>
                    ) : q.status === 'approved' ? (
                      <button className="btn btn-success btn-xs" onClick={() => convertToInvoice(q)}>→ Invoice</button>
                    ) : null}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'delete' ? 'Confirm Delete' : 'Confirm Edit'}
          onSuccess={masterAction.type === 'delete' ? confirmDelete : confirmEdit}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
