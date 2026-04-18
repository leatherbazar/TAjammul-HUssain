import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import { exportDeliveryNotePDF } from '../../utils/pdfExport'
import { calcExpr } from '../../utils/calcExpr'
import toast from 'react-hot-toast'

function DeliveryNoteForm({ initial, onSave, onCancel }) {
  const { data } = useApp()
  const [form, setForm] = useState(initial || {
    clientName: '', clientContact: '', accountHeadID: '', deliveryAddress: '',
    invoiceRef: '',
    date: new Date().toISOString().slice(0, 10),
    driverName: '', vehicleNo: '',
    items: [{ id: Date.now(), description: '', color: '', useMatrix: false, matrixRows: [], qty: 1, note: '' }],
    notes: '', status: 'pending',
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), description: '', color: '', useMatrix: false, matrixRows: [], qty: 1, note: '' }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  const updateMatrix = (id, rows) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))

  // Load data from an invoice
  const loadFromInvoice = (invoiceId) => {
    if (!invoiceId) return
    const inv = (data.invoices || []).find(i => i.id === invoiceId)
    if (!inv) return
    setForm(f => ({
      ...f,
      invoiceRef: inv.number || invoiceId,
      clientName: inv.clientName || '',
      clientContact: inv.clientContact || '',
      accountHeadID: inv.accountHeadID || '',
      items: (inv.items || []).map(i => ({
        id: Date.now() + Math.random(),
        description: i.description || '',
        color: i.color || '',
        useMatrix: false,
        matrixRows: [],
        qty: parseInt(i.qty) || 1,
        note: '',
      })),
    }))
    toast.success(`Loaded from Invoice ${inv.number}`)
  }

  const invoices = data.invoices || []

  return (
    <div>
      {/* Load from Invoice banner */}
      {!initial && invoices.length > 0 && (
        <div style={{
          marginBottom: 14, padding: '12px 16px', borderRadius: 10,
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: 13, color: 'var(--blue)', fontWeight: 700, whiteSpace: 'nowrap' }}>
            📋 Load from Invoice:
          </span>
          <select
            className="input"
            style={{ maxWidth: 320, flex: 1 }}
            defaultValue=""
            onChange={e => { loadFromInvoice(e.target.value); e.target.value = '' }}
          >
            <option value="">— Select invoice to auto-fill —</option>
            {[...invoices].sort((a, b) => (b.number || '').localeCompare(a.number || '')).map(inv => (
              <option key={inv.id} value={inv.id}>
                {inv.number} — {inv.clientName} ({inv.date})
              </option>
            ))}
          </select>
          {form.invoiceRef && (
            <span style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--green)', background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: 6 }}>
              ✓ Ref: {form.invoiceRef}
            </span>
          )}
        </div>
      )}

      <div className="section-box">
        <div className="section-title">🚚 Delivery Details</div>
        <div className="form-grid form-grid-3">
          <div className="input-group">
            <label className="input-label">Client Name *</label>
            <ContactSelect
              type="client"
              value={form.clientName}
              onChange={(name, contact) => {
                setField('clientName', name)
                if (contact) setField('accountHeadID', contact.accountHeadID || '')
              }}
              onContactSelect={c => {
                if (c?.phone) setField('clientContact', c.phone)
                if (c?.address) setField('deliveryAddress', c.address)
              }}
              placeholder="Search client or load from invoice above..."
            />
            {form.accountHeadID && (
              <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3, fontFamily: 'monospace' }}>
                {form.accountHeadID}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Contact</label>
            <input className="input" value={form.clientContact} onChange={e => setField('clientContact', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Delivery Address</label>
            <input className="input" value={form.deliveryAddress} onChange={e => setField('deliveryAddress', e.target.value)} placeholder="Full delivery address" />
          </div>
          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
              {['pending', 'dispatched', 'delivered', 'returned'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Driver Name</label>
            <input className="input" value={form.driverName} onChange={e => setField('driverName', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Vehicle #</label>
            <input className="input" value={form.vehicleNo} onChange={e => setField('vehicleNo', e.target.value)} placeholder="LHR-XXXX" />
          </div>
        </div>
      </div>

      <div className="section-box">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span>📦 Items</span>
          <button className="btn btn-secondary btn-sm" onClick={addItem}>+ Add Item</button>
        </div>
        {form.items.map((item, idx) => {
          const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
          return (
            <div key={item.id} style={{ marginBottom: 12, padding: 14, borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Description #{idx + 1}</label>
                  <input className="input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Item description" spellCheck />
                </div>
                <div className="input-group">
                  <label className="input-label">Color</label>
                  <input className="input" value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} disabled={item.useMatrix} />
                </div>
                <div className="input-group">
                  <label className="input-label">Qty {item.useMatrix ? '(auto)' : ''}</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" inputMode="decimal" className="input" placeholder="0 or 10+5"
                      value={item.useMatrix ? qty : item.qty}
                      onChange={e => updateItem(item.id, 'qty', e.target.value)}
                      onBlur={e => updateItem(item.id, 'qty', calcExpr(e.target.value))}
                      disabled={item.useMatrix} />
                    <button className={`btn btn-xs ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
                      onClick={() => updateItem(item.id, 'useMatrix', !item.useMatrix)}>
                      🎨
                    </button>
                    {form.items.length > 1 && (
                      <button className="btn btn-danger btn-xs" onClick={() => removeItem(item.id)}>✕</button>
                    )}
                  </div>
                </div>
                <div className="input-group col-span-3">
                  <label className="input-label">Note</label>
                  <input className="input" value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)} placeholder="Special instructions..." spellCheck />
                </div>
              </div>
              {item.useMatrix && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--glass-border)' }}>
                  <AttributeMatrix rows={item.matrixRows} onChange={rows => updateMatrix(item.id, rows)} />
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
        <button className="btn btn-primary" onClick={() => {
          if (!form.clientName) { toast.error('Client name required.'); return }
          onSave(form)
        }}>💾 Save</button>
      </div>
    </div>
  )
}

export default function DeliveryNotes() {
  const { data, addRecord, updateRecord, deleteRecord } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [search, setSearch] = useState('')

  const notes = useMemo(() => {
    const list = data.deliveryNotes || []
    if (!search) return list
    return list.filter(n => n.clientName?.toLowerCase().includes(search.toLowerCase()) || n.number?.includes(search))
  }, [data.deliveryNotes, search])

  const handleSave = (f) => {
    if (selected) { updateRecord('deliveryNotes', selected.id, f); toast.success('Updated!') }
    else { const num = `DN-${Date.now().toString().slice(-5)}`; addRecord('deliveryNotes', { ...f, number: num }); toast.success('Delivery note created!') }
    setView('list'); setSelected(null)
  }

  if (view !== 'list') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>🚚 <span>{selected ? 'Edit Delivery Note' : 'New Delivery Note'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <DeliveryNoteForm initial={selected} onSave={handleSave} onCancel={() => { setView('list'); setSelected(null) }} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🚚 <span>Delivery Notes</span></h2>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Delivery Note</button>
      </div>
      <div className="search-bar">
        <input className="input" style={{ maxWidth: 300 }} placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>#</th><th>Client</th><th>Date</th><th>Items</th><th>Driver</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {notes.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No delivery notes.</td></tr>}
            {notes.map(n => (
              <tr key={n.id}>
                <td className="font-mono" style={{ fontSize: 12 }}>{n.number}</td>
                <td>{n.clientName}</td>
                <td style={{ fontSize: 12 }}>{n.date}</td>
                <td>{(n.items || []).length}</td>
                <td style={{ fontSize: 12 }}>{n.driverName || '—'}</td>
                <td><span className={`badge badge-${n.status === 'delivered' ? 'approved' : n.status === 'returned' ? 'cancelled' : 'pending'}`}>{n.status}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => setMasterAction({ type: 'edit', item: n })}>✏️</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: n.id })}>🗑️</button>
                    <button className="btn btn-secondary btn-xs" onClick={() => exportDeliveryNotePDF(n)}>📄</button>
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
            if (masterAction.type === 'delete') { deleteRecord('deliveryNotes', masterAction.id); toast.success('Deleted.') }
            else { setSelected(masterAction.item); setView('edit') }
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
