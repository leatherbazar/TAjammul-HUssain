import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import { exportSupplyOrderPDF } from '../../utils/pdfExport'
import toast from 'react-hot-toast'

function SupplyOrderForm({ initial, onSave, onCancel, isEmployee, currentUser }) {
  const { data } = useApp()
  const [form, setForm] = useState(initial || {
    title: '', supplierName: '', supplierContact: '', accountHeadID: '',
    date: new Date().toISOString().slice(0, 10),
    assignedTo: isEmployee ? currentUser?.id : '',
    items: [{ id: Date.now(), description: '', color: '', qty: 1, marketPrice: 0, useMatrix: false, matrixRows: [], note: '' }],
    notes: '', status: 'pending', priority: 'normal',
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), description: '', color: '', qty: 1, marketPrice: 0, useMatrix: false, matrixRows: [], note: '' }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  const updateMatrix = (id, rows) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))

  const handleSave = () => {
    if (!form.title) { toast.error('Title required.'); return }
    onSave(form)
  }

  return (
    <div>
      <div className="section-box">
        <div className="section-title">🛒 Supply Order Details</div>
        <div className="form-grid form-grid-3">
          <div className="input-group col-span-2">
            <label className="input-label">Order Title *</label>
            <input className="input" value={form.title} onChange={e => setField('title', e.target.value)} placeholder="e.g. Jacket batch for XYZ client" spellCheck />
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          {!isEmployee && (
            <>
              <div className="input-group">
                <label className="input-label">Supplier Name</label>
                <ContactSelect
                  type="supplier"
                  value={form.supplierName}
                  onChange={(name, contact) => {
                    setField('supplierName', name)
                    if (contact) setField('accountHeadID', contact.accountHeadID || '')
                  }}
                  onContactSelect={(c) => {
                    if (c?.phone) setField('supplierContact', c.phone)
                  }}
                  placeholder="Select or type supplier..."
                />
                {form.accountHeadID && (
                  <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3, fontFamily: 'monospace' }}>
                    {form.accountHeadID}
                  </div>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">Supplier Contact</label>
                <input className="input" value={form.supplierContact} onChange={e => setField('supplierContact', e.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label">Assign To Employee</label>
                <select className="input" value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)}>
                  <option value="">— Admin Only —</option>
                  {(data.users?.employees || []).filter(e => e.active).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="input-group">
            <label className="input-label">Priority</label>
            <select className="input" value={form.priority} onChange={e => setField('priority', e.target.value)}>
              {['low', 'normal', 'high', 'urgent'].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
              {['pending', 'in-progress', 'sourced', 'delivered', 'cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="section-box">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span>📦 Items to Source</span>
          {!isEmployee && <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>}
        </div>

        {form.items.map((item, idx) => {
          const matrixQty = calcMatrixTotal(item.matrixRows)
          const qty = item.useMatrix && matrixQty > 0 ? matrixQty : (parseInt(item.qty) || 0)
          const amount = qty * (parseFloat(item.marketPrice) || 0)

          return (
            <div key={item.id} style={{ marginBottom: 14, padding: 14, borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Item #{idx + 1}</label>
                  <input className="input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item description" spellCheck disabled={isEmployee} />
                </div>
                <div className="input-group">
                  <label className="input-label">
                    Qty {item.useMatrix && qty > 0 ? '(auto from matrix)' : ''}
                  </label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    value={item.useMatrix && qty > 0 ? qty : item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    disabled={isEmployee || (item.useMatrix && qty > 0)}
                    style={{ borderColor: item.useMatrix && qty > 0 ? 'var(--amber)' : undefined }}
                    placeholder="Enter qty"
                  />
                  {item.useMatrix && qty === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3 }}>
                      ↑ Enter qty above OR add colors in matrix below
                    </span>
                  )}
                </div>
                {/* Market price — employee can update */}
                <div className="input-group">
                  <label className="input-label">Market Price (PKR) {isEmployee && '← Update'}</label>
                  <input type="number" className="input" min="0" value={item.marketPrice}
                    onChange={e => updateItem(item.id, 'marketPrice', e.target.value)}
                    style={isEmployee ? { borderColor: 'var(--amber)' } : {}} />
                </div>
                <div className="input-group">
                  <label className="input-label">Amount</label>
                  <div style={{ padding: '9px 12px', background: 'var(--glass)', borderRadius: 8, border: '1px solid var(--glass-border)', fontWeight: 700, color: 'var(--green)' }}>
                    PKR {amount.toLocaleString()}
                  </div>
                </div>
                {!isEmployee && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                    <button
                      className={`btn btn-sm ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
                      onClick={() => updateItem(item.id, 'useMatrix', !item.useMatrix)}
                    >🎨 {item.useMatrix ? 'Hide Matrix' : 'Size/Color'}</button>
                    {form.items.length > 1 && (
                      <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button>
                    )}
                  </div>
                )}
                <div className="input-group" style={{ gridColumn: isEmployee ? 'span 2' : 'span 1' }}>
                  <label className="input-label">Field Note</label>
                  <input className="input" value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                    placeholder="e.g. Available at main market..." spellCheck />
                </div>
              </div>

              {item.useMatrix && !isEmployee && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>🎨 Size & Color Breakdown</div>
                  <AttributeMatrix rows={item.matrixRows} onChange={rows => updateMatrix(item.id, rows)} />
                </div>
              )}
              {item.useMatrix && isEmployee && item.matrixRows?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <AttributeMatrix rows={item.matrixRows} onChange={() => {}} readOnly />
                </div>
              )}
            </div>
          )
        })}

        <div className="input-group">
          <label className="input-label">General Notes</label>
          <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} spellCheck />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>💾 Save Order</button>
      </div>
    </div>
  )
}

const PRIORITY_COLORS = { low: 'var(--text-muted)', normal: 'var(--blue)', high: 'var(--amber)', urgent: 'var(--red)' }

export default function SupplyOrders({ isEmployee = false }) {
  const { data, addRecord, updateRecord, deleteRecord, currentUser } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [search, setSearch] = useState('')

  const orders = useMemo(() => {
    let list = data.supplyOrders || []
    if (isEmployee) list = list.filter(o => o.assignedTo === currentUser?.id || !o.assignedTo)
    if (search) list = list.filter(o => o.title?.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [data.supplyOrders, search, isEmployee, currentUser])

  const handleSave = (f) => {
    if (selected) { updateRecord('supplyOrders', selected.id, f); toast.success('Order updated!') }
    else {
      const num = `SO-${Date.now().toString().slice(-5)}`
      addRecord('supplyOrders', { ...f, number: num })
      toast.success('Supply order created!')
    }
    setView('list'); setSelected(null)
  }

  if (view !== 'list') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>🛒 <span>{selected ? 'Edit Supply Order' : 'New Supply Order'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <SupplyOrderForm initial={selected} onSave={handleSave} onCancel={() => { setView('list'); setSelected(null) }} isEmployee={isEmployee} currentUser={currentUser} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🛒 <span>Supply Orders</span></h2>
        {!isEmployee && <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Order</button>}
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 300 }} placeholder="🔍 Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>#</th><th>Title</th><th>Supplier</th><th>Date</th><th>Items</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No supply orders.</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td className="font-mono" style={{ fontSize: 12 }}>{o.number}</td>
                <td style={{ fontWeight: 600 }}>{o.title}</td>
                <td style={{ fontSize: 12 }}>{o.supplierName || '—'}</td>
                <td style={{ fontSize: 12 }}>{o.date}</td>
                <td>{(o.items || []).length}</td>
                <td><span style={{ color: PRIORITY_COLORS[o.priority], fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>{o.priority}</span></td>
                <td><span className={`badge badge-${o.status === 'in-progress' ? 'pending' : o.status}`}>{o.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => { if (isEmployee) { setSelected(o); setView('edit') } else { setMasterAction({ type: 'edit', item: o }) } }}>✏️</button>
                    {!isEmployee && <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: o.id })}>🗑️</button>}
                    <button className="btn btn-secondary btn-xs" onClick={() => exportSupplyOrderPDF(o)} title="Export PDF">📄</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'delete' ? 'Confirm Delete' : 'Confirm Edit'}
          onSuccess={() => {
            if (masterAction.type === 'delete') { deleteRecord('supplyOrders', masterAction.id); toast.success('Deleted.') }
            else { setSelected(masterAction.item); setView('edit') }
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
