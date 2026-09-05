import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { fmtDate } from '../../utils/fmt'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import { exportSupplyOrderPDF } from '../../utils/pdfExport'
import Attachments from '../common/Attachments'
import toast from 'react-hot-toast'

function SupplyOrderForm({ initial, onSave, onCancel, isEmployee, currentUser }) {
  const { data } = useApp()
  const [form, setForm] = useState(initial || {
    title: '', supplierName: '', supplierContact: '', accountHeadID: '',
    date: new Date().toISOString().slice(0, 10),
    assignedTo: isEmployee ? currentUser?.id : '',
    fulfillmentType: 'warehouse',        // Fix 3: warehouse | direct
    clientInvoiceRef: '',
    items: [{ id: Date.now(), description: '', color: '', qty: 1, purchasePrice: 0, marketPrice: 0, isService: false, useMatrix: false, matrixRows: [], note: '' }],
    notes: '', status: 'pending', priority: 'normal',
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), description: '', color: '', qty: 1, purchasePrice: 0, marketPrice: 0, isService: false, useMatrix: false, matrixRows: [], note: '' }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))
  const updateMatrix = (id, rows) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))

  const [saving, setSaving] = useState(false)
  const handleSave = async () => {
    if (!form.title) { toast.error('Title required.'); return }
    if (saving) return
    setSaving(true)
    try { await onSave(form) }
    catch (err) { toast.error(`Save failed: ${err.message || 'Check connection'}`) }
    finally { setSaving(false) }
  }

  // ── Load from Quotation / Invoice ─────────────────────────────────────────
  const [srcType, setSrcType] = useState('')
  const [srcId,   setSrcId]   = useState('')

  const srcOptions = useMemo(() => {
    if (srcType === 'quotation') return (data.quotations || []).map(r => ({ id: r.id, label: `${r.number} — ${r.clientName}`, record: r }))
    if (srcType === 'invoice')   return (data.invoices   || []).map(r => ({ id: r.id, label: `${r.number} — ${r.clientName}`, record: r }))
    return []
  }, [srcType, data.quotations, data.invoices])

  const applySource = () => {
    const opt = srcOptions.find(o => o.id === srcId)
    if (!opt) { toast.error('Select a document first.'); return }
    const rec = opt.record
    const items = (rec.items || []).map(i => {
      const qty = i.useMatrix ? calcMatrixTotal(i.matrixRows || []) : (parseInt(i.qty) || 1)
      return { id: Date.now() + Math.random(), description: i.description || '', color: i.color || '', qty, marketPrice: parseFloat(i.unitPrice) || 0, useMatrix: false, matrixRows: [], note: '' }
    })
    setForm(f => ({
      ...f,
      items,
      title: f.title || [rec.number, rec.title || rec.subject].filter(Boolean).join(' — '),
      notes: rec.notes || f.notes,
      quotationRef: srcType === 'quotation' ? rec.number : f.quotationRef,
      invoiceRef:   srcType === 'invoice'   ? rec.number : f.invoiceRef,
    }))
    toast.success(`Loaded ${items.length} item(s) from ${opt.label}`)
    setSrcId('')
  }

  return (
    <div>
      {/* ── Load from Quotation / Invoice ── */}
      {!initial && (
        <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 10 }}>📥 Load Items from Quotation or Invoice</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Source</label>
              <select className="input" style={{ fontSize: 12, minWidth: 160 }} value={srcType} onChange={e => { setSrcType(e.target.value); setSrcId('') }}>
                <option value="">— Select type —</option>
                <option value="quotation">📋 Quotation</option>
                <option value="invoice">🧾 Invoice</option>
              </select>
            </div>
            {srcType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Select Document</label>
                <select className="input" style={{ fontSize: 12 }} value={srcId} onChange={e => setSrcId(e.target.value)}>
                  <option value="">— Pick document —</option>
                  {srcOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            )}
            {srcType && (
              <button className="btn btn-primary" style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: '#000', fontWeight: 700, alignSelf: 'flex-end' }} onClick={applySource}>
                ✅ Load Items
              </button>
            )}
          </div>
          {(form.quotationRef || form.invoiceRef) && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--green)', fontFamily: 'monospace' }}>
              ✓ Ref: {form.quotationRef || form.invoiceRef}
            </div>
          )}
        </div>
      )}

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
              {['pending', 'in-progress', 'sourced', 'received', 'delivered', 'cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {/* Fix 3: Fulfillment Destination */}
          <div className="input-group col-span-2">
            <label className="input-label">Fulfillment Destination</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['warehouse', '🏭 Into Warehouse Stock'], ['direct', '📦 Direct to Customer (B2B)']].map(([val, label]) => (
                <button key={val} type="button"
                  onClick={() => setField('fulfillmentType', val)}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12,
                    border: `1px solid ${form.fulfillmentType === val ? (val === 'direct' ? 'var(--blue)' : 'var(--green)') : 'var(--glass-border)'}`,
                    background: form.fulfillmentType === val ? (val === 'direct' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.12)') : 'transparent',
                    color: form.fulfillmentType === val ? (val === 'direct' ? 'var(--blue)' : 'var(--green)') : 'var(--text-muted)',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {form.fulfillmentType === 'direct' && (
            <div className="input-group">
              <label className="input-label">Pre-link to Invoice # (optional)</label>
              <input className="input" value={form.clientInvoiceRef}
                onChange={e => setField('clientInvoiceRef', e.target.value)}
                placeholder="e.g. INV-254" />
            </div>
          )}
        </div>
      </div>

      <div className="section-box">
        <div className="section-title">📦 Items to Source</div>

        {form.items.map((item, idx) => {
          const matrixQty = calcMatrixTotal(item.matrixRows)
          const qty = item.useMatrix && matrixQty > 0 ? matrixQty : (parseInt(item.qty) || 0)
          const marketPrice = parseFloat(item.marketPrice) || 0
          const purchasePrice = parseFloat(item.purchasePrice) || 0
          const amount = qty * marketPrice
          const costAmount = qty * purchasePrice
          const profitPct = marketPrice > 0 && purchasePrice > 0 ? ((marketPrice - purchasePrice) / marketPrice * 100).toFixed(1) : null
          const profitAmt = amount - costAmount

          return (
            <div key={item.id} style={{ marginBottom: 14, padding: 14, borderRadius: 10,
              border: `1px solid ${item.isService ? 'rgba(99,102,241,0.35)' : 'var(--glass-border)'}`,
              background: item.isService ? 'rgba(99,102,241,0.04)' : 'rgba(255,255,255,0.02)' }}>
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label className="input-label" style={{ marginBottom: 0 }}>Item #{idx + 1}</label>
                    {/* Fix 1: isService toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700,
                      color: item.isService ? 'var(--blue)' : 'var(--text-muted)' }}>
                      <input type="checkbox" checked={!!item.isService}
                        onChange={e => updateItem(item.id, 'isService', e.target.checked)}
                        style={{ accentColor: 'var(--blue)' }} />
                      Service / Non-Stock (no inventory)
                    </label>
                  </div>
                  <input className="input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)}
                    placeholder={item.isService ? 'Service description (e.g. Labour, Delivery Fee)' : 'Item description'} spellCheck />
                </div>
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <div style={{ flex: '0 0 90px' }}>
                      <label className="input-label">Qty {item.useMatrix && qty > 0 ? '(auto)' : ''}</label>
                      <input
                        type="number" className="input" min="0"
                        value={item.useMatrix && qty > 0 ? qty : item.qty}
                        onChange={e => updateItem(item.id, 'qty', e.target.value)}
                        disabled={item.useMatrix && qty > 0}
                        style={{ borderColor: item.useMatrix && qty > 0 ? 'var(--amber)' : undefined }}
                        placeholder="Enter qty"
                      />
                      {item.useMatrix && qty === 0 && (
                        <span style={{ fontSize: 11, color: 'var(--amber)', marginTop: 3 }}>↑ or matrix below</span>
                      )}
                    </div>
                    <div style={{ flex: '1 1 130px' }}>
                      <label className="input-label" style={{ color: 'var(--amber)' }}>
                        {item.isService ? 'Cost / Fee (PKR)' : 'Purchase Price (PKR) — Cost to Us'}
                      </label>
                      <input type="number" className="input" min="0" value={item.purchasePrice || ''}
                        onChange={e => updateItem(item.id, 'purchasePrice', e.target.value)}
                        placeholder="0" style={{ borderColor: 'rgba(245,158,11,0.4)' }} />
                    </div>
                    {!item.isService && (
                      <div style={{ flex: '1 1 130px' }}>
                        <label className="input-label">Selling Price (PKR) {isEmployee && '← Update'}</label>
                        <input type="number" className="input" min="0" value={item.marketPrice}
                          onChange={e => updateItem(item.id, 'marketPrice', e.target.value)}
                          style={isEmployee ? { borderColor: 'var(--amber)' } : {}} />
                      </div>
                    )}
                    {item.isService && (
                      <div style={{ flex: '1 1 130px', display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.15)',
                          border: '1px solid rgba(99,102,241,0.3)', fontSize: 12, fontWeight: 700, color: 'var(--blue)' }}>
                          🔧 SVC — No Inventory
                        </div>
                      </div>
                    )}
                    {!item.isService && purchasePrice > 0 && marketPrice > 0 && (
                      <div style={{ flex: '0 0 150px' }}>
                        <label className="input-label" style={{ color: profitAmt >= 0 ? 'var(--green)' : '#f87171' }}>Profit Margin</label>
                        <div style={{ padding: '9px 12px', background: profitAmt >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', borderRadius: 8, border: `1px solid ${profitAmt >= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, fontWeight: 700, color: profitAmt >= 0 ? 'var(--green)' : '#f87171', whiteSpace: 'nowrap', fontSize: 13 }}>
                          {profitPct}% · PKR {Math.abs(profitAmt).toLocaleString()}
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <button
                        className={`btn btn-sm ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
                        onClick={() => updateItem(item.id, 'useMatrix', !item.useMatrix)}
                      >🎨 {item.useMatrix ? 'Hide Matrix' : 'Size/Color'}</button>
                      {form.items.length > 1 && (
                        <button className="btn btn-danger btn-sm" onClick={() => removeItem(item.id)}>Remove</button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="input-group" style={{ gridColumn: isEmployee ? 'span 2' : 'span 1' }}>
                  <label className="input-label">Field Note</label>
                  <input className="input" value={item.note} onChange={e => updateItem(item.id, 'note', e.target.value)}
                    placeholder="e.g. Available at main market..." spellCheck />
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

        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ width: '100%', marginBottom: 14 }}>
          + Add Item
        </button>

        <div className="input-group">
          <label className="input-label">General Notes</label>
          <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} spellCheck />
        </div>

        {/* Order Total */}
        {(() => {
          const purchaseTotal = form.items.reduce((sum, item) => {
            const matrixQty = calcMatrixTotal(item.matrixRows)
            const qty = item.useMatrix && matrixQty > 0 ? matrixQty : (parseInt(item.qty) || 0)
            return sum + qty * (parseFloat(item.purchasePrice) || 0)
          }, 0)
          const sellingTotal = form.items.reduce((sum, item) => {
            const matrixQty = calcMatrixTotal(item.matrixRows)
            const qty = item.useMatrix && matrixQty > 0 ? matrixQty : (parseInt(item.qty) || 0)
            return sum + qty * (parseFloat(item.marketPrice) || 0)
          }, 0)
          const totalProfit = sellingTotal - purchaseTotal
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
              {sellingTotal > 0 && (
                <div style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>SELLING TOTAL</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#818cf8', fontFamily: 'monospace' }}>PKR {sellingTotal.toLocaleString()}</div>
                </div>
              )}
              {purchaseTotal > 0 && sellingTotal > 0 && (
                <div style={{ padding: '10px 18px', borderRadius: 10, background: totalProfit >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${totalProfit >= 0 ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`, textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>NET PROFIT</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: totalProfit >= 0 ? 'var(--green)' : '#f87171', fontFamily: 'monospace' }}>PKR {totalProfit.toLocaleString()}</div>
                </div>
              )}
              <div style={{ padding: '12px 24px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>ORDER TOTAL (Purchase)</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)', fontFamily: 'monospace' }}>
                  PKR {purchaseTotal.toLocaleString()}
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <Attachments refId={initial?.id} refType="supply-order" uploadedBy={currentUser?.name} />

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>{saving ? '⏳ Saving…' : '💾 Save Order'}</button>
      </div>
    </div>
  )
}

const PRIORITY_COLORS = { low: 'var(--text-muted)', normal: 'var(--blue)', high: 'var(--amber)', urgent: 'var(--red)' }

// Inline receive-stock modal (used directly in SupplyOrders list)
function ReceiveStockModal({ order, onConfirm, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate]   = useState(today)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  // Determine default: skip inventory for direct/B2B orders or orders linked to a client doc
  const isLinkedToClientDoc = !!(order.invoiceRef || order.quotationRef || order.clientInvoiceRef)
  const isDirect = order.fulfillmentType === 'direct' || isLinkedToClientDoc
  const [addToInventory, setAddToInventory] = useState(!isDirect)

  const totalAmount = (order.items || []).reduce((s, i) =>
    s + (parseInt(i.qty) || 0) * (parseFloat(i.purchasePrice || i.costPrice) || 0), 0)

  const go = async () => {
    setLoading(true)
    try { await onConfirm({ date, notes, addToInventory }) }
    finally { setLoading(false) }
  }

  const linkedRef = order.invoiceRef || order.quotationRef || order.clientInvoiceRef

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: 'linear-gradient(145deg,#1e1e32 0%,#16162a 100%)', borderRadius: 16, padding: 28, maxWidth: 520, width: '100%', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 32px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)' }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 17, fontWeight: 800, color: '#fff' }}>🏭 Confirm & Receive Stock</h3>

        {/* Order summary */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 14, fontSize: 13 }}>
          <div style={{ fontWeight: 700 }}>{order.title} — {order.number}</div>
          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Supplier: <strong style={{ color: 'var(--text)' }}>{order.supplierName || '—'}</strong> &nbsp;|&nbsp;
            Total: <strong style={{ color: 'var(--green)' }}>PKR {totalAmount.toLocaleString()}</strong>
          </div>
          {linkedRef && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#818cf8', fontFamily: 'monospace' }}>
              🔗 Linked to client doc: <strong>{linkedRef}</strong>
            </div>
          )}
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div className="input-group">
            <label className="input-label">Receive Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any remarks…" />
          </div>
        </div>

        {/* Inventory toggle */}
        <div style={{ padding: '12px 14px', borderRadius: 10, marginBottom: 14, border: `1px solid ${addToInventory ? 'rgba(34,197,94,0.35)' : 'rgba(99,102,241,0.35)'}`, background: addToInventory ? 'rgba(34,197,94,0.06)' : 'rgba(99,102,241,0.06)' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={addToInventory}
              onChange={e => setAddToInventory(e.target.checked)}
              style={{ accentColor: 'var(--green)', marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
            />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: addToInventory ? 'var(--green)' : '#818cf8' }}>
                {addToInventory ? '🏭 Add to Warehouse Inventory' : '📦 Skip Inventory (Direct / B2B Fulfilment)'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                {addToInventory
                  ? 'Goods will be added to stock. WAC recalculated. Stock Movement IN recorded.'
                  : 'Goods go directly to the client. No stock change. Supplier AP and DayBook still posted.'}
              </div>
              {isLinkedToClientDoc && !addToInventory && (
                <div style={{ fontSize: 11, color: '#818cf8', marginTop: 4 }}>
                  ℹ️ Defaulted to Skip because this SO is linked to a client document ({linkedRef}).
                </div>
              )}
            </div>
          </label>
        </div>

        {/* Summary of what will happen */}
        <div style={{ fontSize: 12, color: 'var(--amber)', padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', marginBottom: 16 }}>
          ⚠️ This will:
          {addToInventory ? <> add items to <strong>Inventory</strong> ·</> : <> <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>Inventory</span> (skipped) ·</>}
          {' '}create <strong>Purchase record</strong> · post <strong>PKR {totalAmount.toLocaleString()} to Supplier Ledger (AP)</strong>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={go} disabled={loading}>
            {loading ? '⏳ Processing…' : '✅ Confirm & Receive'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SupplyOrders({ isEmployee = false }) {
  const { data, addRecord, updateRecord, deleteRecord, currentUser, refreshData, currentCompany, nextDocNumber } = useApp()
  const navigate = useNavigate()

  const goToInvoice = (o) => {
    // If SO is already linked to an invoice, open that existing document
    const existingRef = o.invoiceRef || o.clientInvoiceRef
    if (existingRef) {
      sessionStorage.setItem('tat_open_invoice_ref', existingRef)
      navigate('/admin/invoices')
      toast(`🧾 Opening existing invoice ${existingRef}`, { duration: 4000 })
      return
    }
    // Otherwise create a new invoice pre-filled from this SO
    const payload = {
      supplyOrderRef: o.number,
      supplyOrderId: o.id,
      items: (o.items || []).map(i => ({
        id: Date.now() + Math.random(),
        description: i.description || '',
        color: i.color || '',
        qty: i.qty || 1,
        unitPrice: parseFloat(i.marketPrice) || 0,
        useMatrix: i.useMatrix || false,
        matrixRows: i.matrixRows || [],
      })),
      notes: o.notes || `From Supply Order ${o.number}`,
    }
    sessionStorage.setItem('tat_so_to_invoice', JSON.stringify(payload))
    navigate('/admin/invoices')
    toast('🧾 Opening Invoice — items loaded from SO ' + o.number, { duration: 4000 })
  }

  const goToQuotation = (o) => {
    // If SO is already linked to a quotation, open that existing document
    if (o.quotationRef) {
      sessionStorage.setItem('tat_open_quotation_ref', o.quotationRef)
      navigate('/admin/quotations')
      toast(`📋 Opening existing quotation ${o.quotationRef}`, { duration: 4000 })
      return
    }
    // Otherwise create a new quotation pre-filled from this SO
    const payload = {
      supplyOrderRef: o.number,
      items: (o.items || []).map(i => ({
        id: Date.now() + Math.random(),
        description: i.description || '',
        color: i.color || '',
        qty: i.qty || 1,
        unitPrice: parseFloat(i.marketPrice) || 0,
        useMatrix: i.useMatrix || false,
        matrixRows: i.matrixRows || [],
      })),
      notes: o.notes || `From Supply Order ${o.number}`,
    }
    sessionStorage.setItem('tat_so_to_quotation', JSON.stringify(payload))
    navigate('/admin/quotations')
    toast('📋 Opening Quotation — items loaded from SO ' + o.number, { duration: 4000 })
  }

  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [receiveModal, setReceiveModal] = useState(null)
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))
  const [dupConfirm, setDupConfirm] = useState(null) // { pendingForm, existing[] }

  const availableMonths = useMemo(() => {
    const seen = new Set()
    for (const o of (data.supplyOrders || [])) { const m = (o.date || o.createdAt || '').slice(0,7); if (m) seen.add(m) }
    return [...seen].sort((a,b) => b.localeCompare(a))
  }, [data.supplyOrders])

  const orders = useMemo(() => {
    let list = data.supplyOrders || []
    if (monthFilter !== 'all') list = list.filter(o => (o.date || o.createdAt || '').slice(0,7) === monthFilter)
    if (isEmployee) list = list.filter(o => o.assignedTo === currentUser?.id || !o.assignedTo)
    if (search) list = list.filter(o => o.title?.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [data.supplyOrders, search, isEmployee, currentUser, monthFilter])

  const createSO = async (f, forcePart = false) => {
    const allOrders = data.supplyOrders || []
    const titleLower = (f.title || '').trim().toLowerCase()

    if (!forcePart) {
      // Find existing SOs with same title (strip "/2", "/3" suffixes for comparison)
      const duplicates = allOrders.filter(o => {
        const base = (o.title || '').replace(/\/\d+$/, '').trim().toLowerCase()
        return base === titleLower
      })
      if (duplicates.length > 0) {
        setDupConfirm({ pendingForm: f, existing: duplicates })
        return
      }
    }

    // Find if any existing SO shares base title to compute part number
    const allOrders2 = data.supplyOrders || []
    const siblings = allOrders2.filter(o => {
      const base = (o.title || '').replace(/\/\d+$/, '').trim().toLowerCase()
      return base === titleLower
    })

    let num = await nextDocNumber('so')
    if (siblings.length > 0) {
      // Use same base number as the first sibling, suffix /2, /3...
      const firstNum = siblings[0].number?.split('/')[0] || num
      num = `${firstNum}/${siblings.length + 1}`
    }

    addRecord('supplyOrders', { ...f, number: num })
    toast.success(`Supply order ${num} created!`)
    setView('list'); setSelected(null)
  }

  const handleSave = async (f) => {
    try {
      if (selected) { updateRecord('supplyOrders', selected.id, f); toast.success('Order updated!'); setView('list'); setSelected(null) }
      else { await createSO(f, false) }
    } catch (err) { throw err }
  }

  const handleReceive = async (order, { date, notes, addToInventory }) => {
    try {
      const res = await fetch(`/api/purchases/from-supply-order/${order.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, notes, skipInventory: !addToInventory }),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || 'Conversion failed'); return }
      const invMsg = addToInventory ? 'Inventory & Supplier Ledger updated.' : 'Supplier Ledger updated (inventory skipped — Direct/B2B).'
      toast.success(`Purchase ${result.purchase?.number} created. ${invMsg}`)
      setReceiveModal(null)
      await refreshData()
    } catch (err) {
      toast.error('Network error — is the server running?')
    }
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
        <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Order</button>
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 240 }} placeholder="🔍 Search orders..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 150 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All Months</option>
          {availableMonths.map(m => { const [y,mo]=m.split('-'); return <option key={m} value={m}>{new Date(+y,+mo-1).toLocaleString('default',{month:'long',year:'numeric'})}</option> })}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>#</th><th>Title / Items</th><th>Supplier</th><th>Date</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No supply orders.</td></tr>}
            {orders.map(o => (
              <tr key={o.id}>
                <td className="font-mono" style={{ fontSize: 12 }}>{o.number}</td>
                <td style={{ maxWidth: 240 }}>
                  {o.title && <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{o.title}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {(o.items || []).slice(0, 2).map((i, idx) => (
                      <span key={idx}>{i.description}{idx < Math.min((o.items||[]).length, 2) - 1 ? ', ' : ''}</span>
                    ))}
                    {(o.items||[]).length > 2 && <span> +{(o.items||[]).length - 2} more</span>}
                  </div>
                </td>
                <td style={{ fontSize: 12 }}>{o.supplierName || '—'}</td>
                <td style={{ fontSize: 12 }}>{o.date}</td>
                <td><span style={{ color: PRIORITY_COLORS[o.priority], fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>{o.priority}</span></td>
                <td>
                  <select
                    value={o.status}
                    onChange={e => updateRecord('supplyOrders', o.id, { ...o, status: e.target.value })}
                    style={{ fontSize: 11, fontWeight: 700, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--glass)', color: o.status === 'delivered' ? 'var(--green)' : o.status === 'received' ? '#34d399' : o.status === 'cancelled' ? '#f87171' : o.status === 'sourced' ? '#818cf8' : 'var(--amber)', cursor: 'pointer', textTransform: 'capitalize' }}
                  >
                    {['pending', 'in-progress', 'sourced', 'received', 'delivered', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => { if (isEmployee) { setSelected(o); setView('edit') } else { setMasterAction({ type: 'edit', item: o }) } }}>✏️</button>
                    {!isEmployee && <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: o.id })}>🗑️</button>}
                    <button className="btn btn-secondary btn-xs" onClick={() => exportSupplyOrderPDF(o, currentCompany)} title="Export PDF">📄</button>
                    {!isEmployee && (
                      <button className="btn btn-xs" title="Create Invoice from this SO"
                        style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', color: '#818cf8', fontWeight: 700, whiteSpace: 'nowrap' }}
                        onClick={() => goToInvoice(o)}>
                        🧾 Invoice
                      </button>
                    )}
                    {!isEmployee && (
                      <button className="btn btn-xs" title="Create Quotation from this SO"
                        style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', color: '#60a5fa', fontWeight: 700, whiteSpace: 'nowrap' }}
                        onClick={() => goToQuotation(o)}>
                        📋 Quote
                      </button>
                    )}
                    {!isEmployee && !o.purchaseRef && o.status !== 'cancelled' && (
                      <button
                        className="btn btn-xs"
                        style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: 'var(--green)', fontWeight: 700, whiteSpace: 'nowrap' }}
                        onClick={() => setReceiveModal(o)}
                        title="Confirm goods received — creates Purchase, updates Inventory"
                      >
                        🏭 Receive
                      </button>
                    )}
                    {o.purchaseRef && (
                      <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'monospace', padding: '2px 6px', background: 'rgba(34,197,94,0.1)', borderRadius: 4 }}>
                        ✓ {o.purchaseRef}
                      </span>
                    )}
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

      {receiveModal && (
        <ReceiveStockModal
          order={receiveModal}
          onConfirm={(opts) => handleReceive(receiveModal, opts)}
          onCancel={() => setReceiveModal(null)}
        />
      )}

      {dupConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--card)', borderRadius: 14, padding: 28, maxWidth: 480, width: '90%', border: '1px solid rgba(245,158,11,0.4)' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>⚠️ Duplicate Supply Order</div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              You already created <strong>{dupConfirm.existing.length}</strong> order(s) with the same title:
            </p>
            <div style={{ background: 'rgba(245,158,11,0.08)', borderRadius: 8, padding: '10px 14px', marginBottom: 18 }}>
              {dupConfirm.existing.map(o => (
                <div key={o.id} style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--amber)', marginBottom: 4 }}>
                  {o.number} — {o.title} <span style={{ color: 'var(--text-muted)' }}>({o.status})</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
              Do you want to create a <strong>Part {dupConfirm.existing.length + 1}</strong>? It will be numbered <strong>{dupConfirm.existing[0]?.number?.split('/')[0]}/{dupConfirm.existing.length + 1}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setDupConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: '#000', fontWeight: 700 }}
                onClick={() => { const f = dupConfirm.pendingForm; setDupConfirm(null); createSO(f, true) }}>
                ✅ Yes, Create Part {dupConfirm.existing.length + 1}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
