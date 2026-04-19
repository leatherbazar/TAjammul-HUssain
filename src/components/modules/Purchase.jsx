import React, { useState, useMemo, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import ContactSelect from '../common/ContactSelect'
import MasterCodeModal from '../common/MasterCodeModal'
import toast from 'react-hot-toast'

// ─── Direct Purchase Form ─────────────────────────────────────────────────────
function PurchaseForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(initial || {
    supplierName: '', supplierContact: '', accountHeadID: '',
    date: today, notes: '',
    items: [{ id: Date.now(), description: '', color: '', qty: 1, unit: 'pcs', costPrice: 0 }],
  })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { id: Date.now(), description: '', color: '', qty: 1, unit: 'pcs', costPrice: 0 }],
  }))
  const removeItem = id => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))

  const totalAmount = form.items.reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.costPrice) || 0), 0)

  const handleSave = async () => {
    if (!form.supplierName) { toast.error('Supplier name required.'); return }
    if (form.items.some(i => !i.description)) { toast.error('All items need a description.'); return }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="section-box">
        <div className="section-title">🏭 Purchase Details</div>
        <div className="form-grid form-grid-3">
          <div className="input-group col-span-2">
            <label className="input-label">Supplier *</label>
            <ContactSelect
              type="supplier"
              value={form.supplierName}
              onChange={(name, contact) => {
                setField('supplierName', name)
                if (contact) setField('accountHeadID', contact.accountHeadID || '')
              }}
              onContactSelect={c => { if (c?.phone) setField('supplierContact', c.phone) }}
              placeholder="Search supplier..."
            />
            {form.accountHeadID && (
              <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3, fontFamily: 'monospace' }}>{form.accountHeadID}</div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Contact</label>
            <input className="input" value={form.supplierContact} onChange={e => setField('supplierContact', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Purchase Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any remarks..." />
          </div>
        </div>
      </div>

      <div className="section-box">
        <div className="section-title">📦 Items Purchased</div>
        {form.items.map((item, idx) => {
          const amount = (parseInt(item.qty) || 0) * (parseFloat(item.costPrice) || 0)
          return (
            <div key={item.id} style={{ marginBottom: 12, padding: 14, borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <label className="input-label">Description #{idx + 1}</label>
                  <input className="input" value={item.description}
                    onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Item name / description" spellCheck />
                </div>
                <div className="input-group">
                  <label className="input-label">Color</label>
                  <input className="input" value={item.color}
                    onChange={e => updateItem(item.id, 'color', e.target.value)} placeholder="Black, Red…" />
                </div>
                <div className="input-group">
                  <label className="input-label">Qty</label>
                  <input type="number" className="input" min="1" value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <input className="input" list="unit-list-p" value={item.unit}
                    onChange={e => updateItem(item.id, 'unit', e.target.value)} placeholder="pcs, sqt…" />
                  <datalist id="unit-list-p">
                    {['pcs', 'sqt', 'meters', 'kg', 'pairs', 'sets', 'dozen', 'yards', 'rolls', 'boxes'].map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div className="input-group">
                  <label className="input-label">Cost Price (PKR)</label>
                  <input type="number" className="input" min="0" value={item.costPrice}
                    onChange={e => updateItem(item.id, 'costPrice', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">Amount</label>
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--glass-border)', fontWeight: 700, color: 'var(--green)' }}>
                    PKR {amount.toLocaleString()}
                  </div>
                </div>
                {form.items.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ width: '100%', marginBottom: 14 }}>
          + Add Item
        </button>

        <div style={{ textAlign: 'right', padding: '10px 16px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Purchase Amount: </span>
          <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)', fontFamily: 'Orbitron, sans-serif' }}>
            PKR {totalAmount.toLocaleString()}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Saving…' : '💾 Save Purchase'}
        </button>
      </div>
    </div>
  )
}

// ─── Convert SO Modal ─────────────────────────────────────────────────────────
function ConvertSOModal({ order, onConfirm, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const totalAmount = (order.items || []).reduce((s, i) =>
    s + (parseInt(i.qty) || 0) * (parseFloat(i.marketPrice) || 0), 0)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm({ date, notes })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ background: 'var(--card-bg)', borderRadius: 14, padding: 28, maxWidth: 520, width: '100%', border: '1px solid var(--glass-border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>🏭 Confirm & Receive Stock</h3>

        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 18, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{order.title} ({order.number})</div>
          <div style={{ color: 'var(--text-muted)' }}>Supplier: <strong style={{ color: 'var(--text)' }}>{order.supplierName || '—'}</strong></div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>Items: {(order.items || []).length} | Total: <strong style={{ color: 'var(--green)' }}>PKR {totalAmount.toLocaleString()}</strong></div>
        </div>

        {(order.items || []).map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
            <span>{item.description} {item.color ? `(${item.color})` : ''}</span>
            <span>{item.qty} × PKR {Number(item.marketPrice || 0).toLocaleString()} = <strong style={{ color: 'var(--green)' }}>PKR {((parseInt(item.qty) || 0) * (parseFloat(item.marketPrice) || 0)).toLocaleString()}</strong></span>
          </div>
        ))}

        <div className="form-grid form-grid-2" style={{ marginTop: 18 }}>
          <div className="input-group">
            <label className="input-label">Receive Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Notes (optional)</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
          </div>
        </div>

        <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)', fontSize: 12, color: 'var(--amber)' }}>
          ⚠️ This will: <strong>add items to Inventory</strong> · <strong>create a Purchase record</strong> · <strong>post PKR {totalAmount.toLocaleString()} to Supplier Ledger (AP)</strong>
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? '⏳ Processing…' : '✅ Confirm & Receive'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Purchase Module ─────────────────────────────────────────────────────
export default function Purchases() {
  const { data, addRecord, updateRecord, deleteRecord, refreshData } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [convertModal, setConvertModal] = useState(null) // supply order to convert
  const [masterAction, setMasterAction] = useState(null)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('purchases') // 'purchases' | 'supply-orders'
  const [accountHeads, setAccountHeads] = useState(null)

  // Load account heads summary on mount
  useState(() => {
    fetch('/api/account-heads')
      .then(r => r.json())
      .then(setAccountHeads)
      .catch(() => {})
  }, [])

  const purchases = useMemo(() => {
    const list = data.purchases || []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(p => p.supplierName?.toLowerCase().includes(q) || p.number?.includes(q))
  }, [data.purchases, search])

  // Supply orders NOT yet converted to purchase
  const pendingSOs = useMemo(() => {
    return (data.supplyOrders || []).filter(o => !o.purchaseRef && o.status !== 'cancelled')
  }, [data.supplyOrders])

  const handleDirectPurchase = async (form) => {
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || 'Save failed'); return }
      toast.success(`Purchase ${result.number} saved! Inventory updated.`)
      await refreshData()
      setView('list')
    } catch (err) {
      toast.error('Network error — check server')
    }
  }

  const handleConvertSO = async (order, { date, notes }) => {
    try {
      const res = await fetch(`/api/purchases/from-supply-order/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, notes }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || 'Conversion failed'); return }
      toast.success(`${result.purchase?.number} created! Stock added. Supplier ledger updated.`)
      setConvertModal(null)
      await refreshData()
    } catch (err) {
      toast.error('Network error')
    }
  }

  if (view !== 'list') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>🏭 <span>{selected ? 'Edit Purchase' : 'New Direct Purchase'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <PurchaseForm
          initial={selected}
          onSave={handleDirectPurchase}
          onCancel={() => { setView('list'); setSelected(null) }}
        />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🏭 <span>Purchases & Stock In</span></h2>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Purchase</button>
      </div>

      {/* Account Heads Summary */}
      {accountHeads && (
        <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
          <div className="stat-card card-blue">
            <div className="label">📦 Inventory Asset</div>
            <div className="value" style={{ fontSize: 16 }}>PKR {Number(accountHeads.inventoryValue || 0).toLocaleString()}</div>
          </div>
          <div className="stat-card card-amber">
            <div className="label">⚠️ Accounts Payable</div>
            <div className="value" style={{ fontSize: 16 }}>PKR {Number(accountHeads.accountsPayable || 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Amount owed to suppliers</div>
          </div>
          <div className="stat-card card-green">
            <div className="label">✅ Total Purchases</div>
            <div className="value" style={{ fontSize: 16 }}>PKR {Number(accountHeads.totalPurchases || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button className={`btn btn-sm ${tab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('purchases')}>
          🏭 Purchases ({purchases.length})
        </button>
        <button className={`btn btn-sm ${tab === 'supply-orders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('supply-orders')}>
          🛒 Pending Supply Orders ({pendingSOs.length})
        </button>
      </div>

      {tab === 'purchases' && (
        <>
          <div className="search-bar">
            <input className="input" style={{ maxWidth: 300 }} placeholder="🔍 Search by supplier or #..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>#</th><th>Supplier</th><th>Date</th><th>Items</th><th>Total</th><th>Paid</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {purchases.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No purchases yet. Convert a supply order or create a direct purchase.</td></tr>
                )}
                {purchases.map(p => {
                  const balance = (p.totalAmount || 0) - (p.paidAmount || 0)
                  return (
                    <tr key={p.id}>
                      <td className="font-mono" style={{ fontSize: 12 }}>{p.number}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.supplierName || '—'}</div>
                        {p.supplyOrderNumber && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>from {p.supplyOrderNumber}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{p.date}</td>
                      <td>{(p.items || []).length}</td>
                      <td style={{ fontWeight: 700 }}>PKR {Number(p.totalAmount || 0).toLocaleString()}</td>
                      <td>
                        <div>PKR {Number(p.paidAmount || 0).toLocaleString()}</div>
                        {balance > 0 && <div style={{ fontSize: 11, color: 'var(--red)' }}>Bal: PKR {Number(balance).toLocaleString()}</div>}
                      </td>
                      <td>
                        <span className={`badge badge-${p.paymentStatus === 'paid' ? 'approved' : p.paymentStatus === 'partial' ? 'pending' : 'draft'}`}>
                          {p.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-xs" onClick={() => setMasterAction({ type: 'edit', item: p })} title="Edit">✏️</button>
                          <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: p.id })} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'supply-orders' && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>#</th><th>Title</th><th>Supplier</th><th>Date</th><th>Items</th><th>Est. Value</th><th>Priority</th><th>Action</th></tr>
            </thead>
            <tbody>
              {pendingSOs.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No pending supply orders to convert.</td></tr>
              )}
              {pendingSOs.map(o => {
                const est = (o.items || []).reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.marketPrice) || 0), 0)
                return (
                  <tr key={o.id}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{o.number}</td>
                    <td style={{ fontWeight: 600 }}>{o.title}</td>
                    <td style={{ fontSize: 12 }}>{o.supplierName || '—'}</td>
                    <td style={{ fontSize: 12 }}>{o.date}</td>
                    <td>{(o.items || []).length}</td>
                    <td style={{ color: 'var(--green)', fontWeight: 700 }}>PKR {est.toLocaleString()}</td>
                    <td><span style={{ fontSize: 12, textTransform: 'capitalize', fontWeight: 700, color: o.priority === 'urgent' ? 'var(--red)' : o.priority === 'high' ? 'var(--amber)' : 'var(--blue)' }}>{o.priority}</span></td>
                    <td>
                      <button
                        className="btn btn-primary btn-xs"
                        onClick={() => setConvertModal(o)}
                        title="Confirm goods received — creates Purchase, updates Inventory, posts to Supplier Ledger"
                      >
                        🏭 Receive Stock
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Convert SO Modal */}
      {convertModal && (
        <ConvertSOModal
          order={convertModal}
          onConfirm={(opts) => handleConvertSO(convertModal, opts)}
          onCancel={() => setConvertModal(null)}
        />
      )}

      {/* Master Code for edit/delete */}
      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'delete' ? 'Confirm Delete' : 'Confirm Edit'}
          onSuccess={() => {
            if (masterAction.type === 'delete') {
              deleteRecord('purchases', masterAction.id)
              toast.success('Purchase deleted.')
            } else {
              setSelected(masterAction.item)
              setView('edit')
            }
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
