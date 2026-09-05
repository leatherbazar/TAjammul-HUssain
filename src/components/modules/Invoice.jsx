import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate } from '../../utils/fmt'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import UniversalPaymentModal from '../common/UniversalPaymentModal'
import { exportInvoicePDF } from '../../utils/pdfExport'
import Attachments from '../common/Attachments'
import { calcExpr } from '../../utils/calcExpr'
import toast from 'react-hot-toast'

const TAX_OPTIONS = [
  { label: 'No Tax', val: 0 },
  { label: '5.5%', val: 5.5 },
  { label: '15%', val: 15 },
  { label: '18%', val: 18 },
  { label: 'Custom', val: -1 },
]

// RecordPaymentModal replaced by UniversalPaymentModal (imported above)

// ─── Remaining Qty Card ──────────────────────────────────────────────────────
function RemainingQtyCard({ invoice, deliveryNotes }) {
  const related = deliveryNotes.filter(dn => dn.invoiceRef === invoice.number)
  if (related.length === 0) return null

  // Calculate delivered qty per item description
  const deliveredMap = {}
  related.forEach(dn => {
    ;(dn.items || []).forEach(item => {
      deliveredMap[item.description] = (deliveredMap[item.description] || 0) + (parseInt(item.qty) || 0)
    })
  })

  const rows = (invoice.items || []).map(item => {
    const invoicedQty = parseInt(item.qty) || 0
    const deliveredQty = deliveredMap[item.description] || 0
    const remaining = invoicedQty - deliveredQty
    return { description: item.description, invoicedQty, deliveredQty, remaining }
  }).filter(r => r.invoicedQty > 0)

  const hasPartial = rows.some(r => r.remaining > 0 && r.deliveredQty > 0)
  const allDelivered = rows.every(r => r.remaining <= 0)

  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 10,
      background: allDelivered ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
      border: `1px solid ${allDelivered ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: allDelivered ? 'var(--green)' : 'var(--amber)' }}>
        {allDelivered ? '✅ Fully Delivered' : `📦 Delivery Status — ${related.length} delivery note(s)`}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {rows.map(r => (
          <div key={r.description} style={{
            padding: '6px 12px', borderRadius: 8,
            background: r.remaining <= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
            border: `1px solid ${r.remaining <= 0 ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
            fontSize: 12,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 2 }}>{r.description.slice(0, 30)}</div>
            <div style={{ color: 'var(--text-muted)' }}>
              Invoiced: <strong>{r.invoicedQty}</strong> &nbsp;|&nbsp;
              Delivered: <strong style={{ color: 'var(--green)' }}>{r.deliveredQty}</strong> &nbsp;|&nbsp;
              Remaining: <strong style={{ color: r.remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{r.remaining}</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared qty/price inputs ─────────────────────────────────────────────────
function QtyInput({ value, onChange, onBlur, style = {} }) {
  return (
    <input
      type="text" inputMode="decimal" className="input input-qty-cell"
      style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.4)', textAlign: 'center', color: 'var(--blue)', fontWeight: 900, ...style }}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onBlur(calcExpr(e.target.value))}
      placeholder="0"
    />
  )
}

function PriceInput({ value, onChange, onBlur, style = {} }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }}>PKR</span>
      <input
        type="text" inputMode="decimal" className="input input-price-cell"
        style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', paddingLeft: 34, color: 'var(--amber)', fontWeight: 900, width: '100%', ...style }}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onBlur(calcExpr(e.target.value))}
        placeholder="0"
      />
    </div>
  )
}

// ─── Inline Editable Row (desktop table) ────────────────────────────────────
function ItemRow({ item, index, onChange, onDelete, onMatrixChange }) {
  const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
  const amount = qty * (parseFloat(item.unitPrice) || 0)
  return (
    <>
      <tr>
        <td style={{ width: 32, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>{index + 1}</td>
        <td>
          <input
            className="input"
            style={{ background: 'transparent', border: '1px solid transparent', padding: '6px 8px' }}
            value={item.description}
            onChange={e => onChange('description', e.target.value)}
            placeholder="Item description"
            spellCheck
            onFocus={e => e.target.style.borderColor = 'var(--red)'}
            onBlur={e => e.target.style.borderColor = 'transparent'}
          />
        </td>
        <td style={{ width: 110 }}>
          <input
            className="input"
            style={{ background: 'transparent', border: '1px solid transparent', padding: '6px 8px', fontSize: 12 }}
            value={item.color || ''}
            onChange={e => onChange('color', e.target.value)}
            placeholder="e.g. Black"
            disabled={item.useMatrix}
          />
        </td>
        <td style={{ width: 95 }}>
          <QtyInput
            value={item.useMatrix ? qty : item.qty}
            onChange={v => onChange('qty', v)}
            onBlur={v => onChange('qty', v)}
            style={{ width: 82, padding: '6px 8px', opacity: item.useMatrix ? 0.6 : 1 }}
          />
        </td>
        <td style={{ width: 135 }}>
          <PriceInput value={item.unitPrice} onChange={v => onChange('unitPrice', v)} onBlur={v => onChange('unitPrice', v)} style={{ padding: '6px 8px 6px 34px' }} />
        </td>
        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)', paddingRight: 12, whiteSpace: 'nowrap', fontSize: 13 }}>
          PKR {amount.toLocaleString()}
        </td>
        <td style={{ width: 60, textAlign: 'center' }}>
          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
            <button
              className={`btn btn-xs ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
              onClick={() => onChange('useMatrix', !item.useMatrix)}
              title="Toggle size/color matrix"
              style={{ padding: '3px 6px', fontSize: 13 }}
            >🎨</button>
            <button className="btn btn-danger btn-xs" onClick={onDelete} title="Remove row" style={{ padding: '3px 8px' }}>✕</button>
          </div>
        </td>
      </tr>
      {item.useMatrix && (
        <tr>
          <td colSpan={8} style={{ padding: '0 8px 10px 40px', background: 'rgba(245,158,11,0.04)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 6, marginTop: 6 }}>🎨 Size & Color Breakdown</div>
            <AttributeMatrix rows={item.matrixRows || []} onChange={onMatrixChange} />
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Mobile Card (stacked layout) ───────────────────────────────────────────
function ItemCard({ item, index, onChange, onDelete, onMatrixChange }) {
  const qty = item.useMatrix ? calcMatrixTotal(item.matrixRows) : (parseInt(item.qty) || 0)
  const amount = qty * (parseFloat(item.unitPrice) || 0)
  return (
    <div style={{ padding: '16px', borderRadius: 12, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.04)', marginBottom: 12 }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 700 }}>Item {index + 1}</span>
        <button className="btn btn-danger btn-xs" onClick={onDelete} style={{ padding: '6px 14px', fontSize: 13 }}>✕ Remove</button>
      </div>

      {/* Description */}
      <div className="input-group" style={{ marginBottom: 14 }}>
        <label className="input-label" style={{ fontSize: 13, marginBottom: 6 }}>Description</label>
        <input className="input" value={item.description} onChange={e => onChange('description', e.target.value)}
          placeholder="Item description" spellCheck
          style={{ fontSize: 17, padding: '12px 14px', minHeight: 50 }} />
      </div>

      {/* Color + Matrix toggle */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, marginBottom: 12, alignItems: 'flex-end' }}>
        <div className="input-group">
          <label className="input-label" style={{ fontSize: 13, marginBottom: 6 }}>Color (single)</label>
          <input className="input" value={item.color || ''} onChange={e => onChange('color', e.target.value)}
            placeholder="e.g. Black" disabled={item.useMatrix} />
        </div>
        <button
          className={`btn btn-sm ${item.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
          onClick={() => onChange('useMatrix', !item.useMatrix)}
          style={{ marginBottom: 2, whiteSpace: 'nowrap' }}
        >
          🎨 {item.useMatrix ? 'Hide Matrix' : 'Size/Color'}
        </button>
      </div>

      {/* Matrix (when active) */}
      {item.useMatrix && (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>🎨 Size & Color Breakdown</div>
          <AttributeMatrix rows={item.matrixRows || []} onChange={onMatrixChange} />
        </div>
      )}

      {/* QTY + PRICE big fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--blue)', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
            QTY {item.useMatrix ? '(auto)' : '✏️'}
          </label>
          <QtyInput value={item.useMatrix ? qty : item.qty} onChange={v => onChange('qty', v)} onBlur={v => onChange('qty', v)}
            style={{ padding: '16px 10px', fontSize: 26, width: '100%', minHeight: 62, letterSpacing: 1, opacity: item.useMatrix ? 0.6 : 1 }} />
        </div>
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--amber)', fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
            UNIT PRICE ✏️
          </label>
          <PriceInput value={item.unitPrice} onChange={v => onChange('unitPrice', v)} onBlur={v => onChange('unitPrice', v)}
            style={{ padding: '16px 10px 16px 38px', fontSize: 22, minHeight: 62 }} />
        </div>
      </div>

      {/* Amount */}
      <div style={{ textAlign: 'right', fontWeight: 900, color: 'var(--green)', fontSize: 18, padding: '8px 0', borderTop: '1px solid var(--glass-border)' }}>
        Total: PKR {amount.toLocaleString()}
      </div>
    </div>
  )
}

// ─── Generate Delivery Note Modal ────────────────────────────────────────────
function GenerateDNModal({ invoice, existingDNs, onGenerate, onCancel }) {
  // Pre-calculate already-delivered qty per item
  const alreadyDelivered = useMemo(() => {
    const map = {}
    existingDNs.forEach(dn => {
      ;(dn.items || []).forEach(item => {
        map[item.description] = (map[item.description] || 0) + (parseInt(item.qty) || 0)
      })
    })
    return map
  }, [existingDNs])

  const [dnItems, setDnItems] = useState(() =>
    (invoice.items || []).map(i => {
      const invoicedQty = parseInt(i.qty) || 0
      const delivered = alreadyDelivered[i.description] || 0
      const remaining = Math.max(0, invoicedQty - delivered)
      return { ...i, invoicedQty, delivered, dnQty: remaining, id: i.id || Date.now() + Math.random() }
    })
  )
  const [driverName, setDriverName] = useState('')
  const [vehicleNo, setVehicleNo] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  // Rule 4: manufacturing tolerance %
  const [tolerance, setTolerance] = useState(5)

  const toleranceInfo = dnItems.map(item => {
    const remaining = item.invoicedQty - item.delivered
    const dnQty = parseInt(item.dnQty) || 0
    const shortfall = remaining - dnQty
    const pct = remaining > 0 ? (shortfall / remaining) * 100 : 0
    return { shortfall, pct, withinTolerance: shortfall > 0 && pct <= tolerance, overDelivery: dnQty > remaining }
  })

  const allWithinTolerance = dnItems.length > 0 && dnItems.every((item, i) => {
    const dnQty = parseInt(item.dnQty) || 0
    const remaining = item.invoicedQty - item.delivered
    return dnQty >= remaining || toleranceInfo[i].withinTolerance
  })

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-lg fade-in" style={{ maxWidth: 760 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">🚚 Generate Delivery Note from {invoice.number}</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Adjust delivery quantities — remaining qty is pre-filled. Use tolerance to auto-close minor shortfalls.
        </p>

        {/* Rule 4: Tolerance setting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', whiteSpace: 'nowrap' }}>⚖️ Tolerance ±</span>
          <input
            type="number" min={0} max={20} step={0.5}
            className="input"
            style={{ width: 72, textAlign: 'center', fontWeight: 700, borderColor: 'var(--blue)' }}
            value={tolerance}
            onChange={e => setTolerance(parseFloat(e.target.value) || 0)}
          />
          <span style={{ fontSize: 13, color: 'var(--blue)' }}>%</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>Short deliveries within this % of remaining qty will auto-close the balance.</span>
          {allWithinTolerance && (
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', whiteSpace: 'nowrap', padding: '3px 10px', background: 'rgba(34,197,94,0.12)', borderRadius: 6 }}>
              ✅ Will auto-close
            </span>
          )}
        </div>

        <div className="form-grid form-grid-3" style={{ marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Driver Name</label>
            <input className="input" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver" />
          </div>
          <div className="input-group">
            <label className="input-label">Vehicle #</label>
            <input className="input" value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="LHR-XXXX" />
          </div>
          <div className="input-group">
            <label className="input-label">Delivery Address</label>
            <input className="input" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full address" />
          </div>
        </div>

        <div className="table-wrapper" style={{ marginBottom: 14 }}>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ textAlign: 'center' }}>Invoiced</th>
                <th style={{ textAlign: 'center', color: 'var(--green)' }}>Delivered</th>
                <th style={{ textAlign: 'center', color: 'var(--red)' }}>Remaining</th>
                <th style={{ textAlign: 'center', color: 'var(--amber)' }}>This Delivery ✏️</th>
                <th style={{ textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {dnItems.map((item, idx) => {
                const tol = toleranceInfo[idx]
                const dnQty = parseInt(item.dnQty) || 0
                const remaining = item.invoicedQty - item.delivered
                const isFull = dnQty >= remaining
                return (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.description}</td>
                    <td style={{ textAlign: 'center' }}>{item.invoicedQty}</td>
                    <td style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{item.delivered}</td>
                    <td style={{ textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{remaining}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="number"
                        className="input"
                        style={{ width: 90, borderColor: tol.withinTolerance ? 'var(--green)' : 'var(--amber)', background: tol.withinTolerance ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', textAlign: 'center', fontWeight: 800 }}
                        min="0"
                        value={item.dnQty}
                        onChange={e => setDnItems(prev => prev.map(i => i.id === item.id ? { ...i, dnQty: e.target.value } : i))}
                      />
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>
                      {isFull ? (
                        <span style={{ color: 'var(--green)', fontWeight: 700 }}>✅ Full</span>
                      ) : tol.withinTolerance ? (
                        <span style={{ color: 'var(--blue)', fontWeight: 700 }}>⚖️ -{tol.shortfall} ({tol.pct.toFixed(1)}%)</span>
                      ) : tol.overDelivery ? (
                        <span style={{ color: 'var(--amber)', fontWeight: 700 }}>⚠️ Over</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Partial</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {allWithinTolerance && (
          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', marginBottom: 14, fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
            ✅ All items within {tolerance}% tolerance — balance will auto-close on creation.
          </div>
        )}

        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">Notes</label>
          <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Special delivery instructions..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const itemsToDeliver = dnItems.filter(i => parseInt(i.dnQty) > 0)
            if (itemsToDeliver.length === 0) { toast.error('Enter at least one delivery qty.'); return }
            onGenerate({
              clientName: invoice.clientName,
              clientContact: invoice.clientContact,
              invoiceRef: invoice.number,
              driverName, vehicleNo,
              deliveryAddress: address,
              notes,
              date: new Date().toISOString().slice(0, 10),
              items: itemsToDeliver.map(i => ({
                description: i.description,
                qty: parseInt(i.dnQty) || 0,
                color: i.color || '',
              })),
              status: 'pending',
              tolerancePct: tolerance,
              autoClose: allWithinTolerance,
            })
          }}>
            ✅ Create Delivery Note
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────
function InvoiceForm({ initial, fromQuotation, onSave, onCancel, onOpenDN }) {
  const { data, nextInvoiceNumber, currentCompany, currentUser } = useApp()
  const [form, setForm] = useState(() => {
    if (fromQuotation) {
      return {
        number: '',
        quotationRef: fromQuotation.number,
        quotationId: fromQuotation.id,
        accountHeadID: fromQuotation.accountHeadID || '',
        clientName: fromQuotation.clientName || '',
        clientContact: fromQuotation.clientContact || '',
        clientAddress: fromQuotation.clientAddress || '',
        date: new Date().toISOString().slice(0, 10),
        dueDate: '',
        items: (fromQuotation.items || []).map(i => ({
          id: Date.now() + Math.random(),
          description: i.description || '',
          color: i.color || '',
          qty: i.useMatrix
            ? calcMatrixTotal(i.matrixRows || [])
            : (parseInt(i.qty) || 1),
          unitPrice: parseFloat(i.unitPrice) || 0,
          useMatrix: i.useMatrix || false,
          matrixRows: i.matrixRows || [],
        })),
        taxRate: fromQuotation.taxRate || 0,
        customTax: '',
        advancePaid: 0,
        notes: fromQuotation.notes || '',
        subject: fromQuotation.subject || '',
        stealthPrint: false,
        status: 'unpaid',
      }
    }
    if (initial) return { ...initial }
    return {
      number: '',
      quotationRef: '',
      accountHeadID: '',
      clientName: '',
      clientContact: '',
      clientAddress: '',
      date: new Date().toISOString().slice(0, 10),
      dueDate: '',
      items: [{ id: Date.now(), description: '', color: '', qty: 1, unitPrice: 0, useMatrix: false, matrixRows: [] }],
      taxRate: 0,
      customTax: '',
      advancePaid: 0,
      notes: '',
      subject: '',
      stealthPrint: false,
      status: 'unpaid',
    }
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Auto-resolve accountHeadID when converting from quotation ───────────────
  // If clientName is pre-filled from the quote but accountHeadID is missing,
  // search contacts by name and auto-link the account.
  useEffect(() => {
    if (!fromQuotation) return
    if (form.accountHeadID) return  // already linked
    if (!form.clientName) return
    fetch(`/api/contacts/search?q=${encodeURIComponent(form.clientName)}&type=client`)
      .then(r => r.json())
      .then(d => {
        const matches = d.contacts || []
        // Only auto-link if exactly one match (unambiguous)
        if (matches.length === 1) {
          setForm(f => ({ ...f, accountHeadID: matches[0].accountHeadID }))
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const updateItem = useCallback((id, field, value) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [field]: value } : i) }))
  }, [])

  const addBlankRow = () => setForm(f => ({
    ...f, items: [...f.items, { id: Date.now(), description: '', color: '', qty: 1, unitPrice: 0, useMatrix: false, matrixRows: [] }]
  }))

  const updateMatrix = useCallback((id, rows) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, matrixRows: rows } : i) }))
  }, [])

  const deleteRow = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))

  const effectiveTax = form.taxRate === -1 ? parseFloat(form.customTax || 0) : (form.taxRate || 0)
  const subtotal = form.items.reduce((s, i) => {
    const qty = i.useMatrix ? calcMatrixTotal(i.matrixRows) : (parseInt(i.qty) || 0)
    return s + qty * (parseFloat(i.unitPrice) || 0)
  }, 0)
  const taxAmount = subtotal * effectiveTax / 100
  const total = subtotal + taxAmount
  const balance = total - (parseFloat(form.advancePaid) || 0)

  const [saving, setSaving] = useState(false)

  // ── Smart Source Loader (vendor→client price conversion) ─────────────────────
  const [sourceType, setSourceType] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [markupPct, setMarkupPct] = useState(10)

  const sourceOptions = useMemo(() => {
    if (sourceType === 'quotation')   return (data.quotations   || []).map(r => ({ id: r.id, label: `${r.number} — ${r.clientName}`,   record: r }))
    if (sourceType === 'supplyOrder') return (data.supplyOrders || []).map(r => ({ id: r.id, label: `${r.number} — ${r.supplierName || r.title}`, record: r }))
    if (sourceType === 'purchase')    return (data.purchases    || []).map(r => ({ id: r.id, label: `${r.number} — ${r.supplierName}`,  record: r }))
    return []
  }, [sourceType, data.quotations, data.supplyOrders, data.purchases])

  const applySource = () => {
    const opt = sourceOptions.find(o => o.id === sourceId)
    if (!opt) { toast.error('Select a document first.'); return }
    const rec = opt.record
    const markup = parseFloat(markupPct) || 0
    const items = (rec.items || []).map(i => {
      let basePrice = 0
      if (sourceType === 'quotation')   basePrice = parseFloat(i.unitPrice)   || 0
      if (sourceType === 'supplyOrder') basePrice = parseFloat(i.marketPrice) || 0
      if (sourceType === 'purchase')    basePrice = parseFloat(i.costPrice)   || 0
      const sellingPrice = sourceType === 'quotation'
        ? basePrice
        : parseFloat((basePrice * (1 + markup / 100)).toFixed(2))
      const qty = i.useMatrix ? calcMatrixTotal(i.matrixRows || []) : (parseInt(i.qty) || 1)
      return { id: Date.now() + Math.random(), description: i.description || '', color: i.color || '', qty, unitPrice: sellingPrice, useMatrix: false, matrixRows: [] }
    })
    setForm(f => ({
      ...f, items,
      clientName:    rec.clientName    || f.clientName,
      clientContact: rec.clientContact || f.clientContact,
      clientAddress: rec.clientAddress || f.clientAddress,
      accountHeadID: rec.accountHeadID || f.accountHeadID,
      notes:         rec.notes || f.notes,
      ...(sourceType === 'quotation'   && { quotationRef:    rec.number }),
      ...(sourceType === 'supplyOrder' && { supplyOrderRef:  rec.number }),
      ...(sourceType === 'purchase'    && { purchaseRef:     rec.number }),
    }))
    toast.success(`Loaded ${items.length} item(s) from ${opt.label}${sourceType !== 'quotation' ? ` (+${markup}% markup)` : ''}`)
    setSourceId('')
  }

  const handleSave = async () => {
    if (!form.clientName) { toast.error('Client name required.'); return }
    if (form.items.length === 0) { toast.error('Add at least one item.'); return }
    // accountHeadID will be auto-registered on the server if missing — no warning needed
    setSaving(true)
    try {
      const num = form.number || await nextInvoiceNumber()
      if (!num) throw new Error('Could not generate invoice number')
      await onSave({ ...form, number: num, subtotal, taxAmount, total, taxRate: effectiveTax })
    } catch (err) {
      toast.error(`Save failed: ${err.message || 'Check your connection'}`)
    } finally {
      setSaving(false)
    }
  }

  // Related delivery notes (only if editing existing invoice)
  const relatedDNs = useMemo(() => {
    if (!initial?.number) return []
    return (data.deliveryNotes || []).filter(dn => dn.invoiceRef === initial.number)
  }, [data.deliveryNotes, initial])

  return (
    <div>
      {fromQuotation && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', marginBottom: 16, fontSize: 13 }}>
          📋 Converted from Quotation <strong style={{ color: 'var(--blue)' }}>{fromQuotation.number}</strong> — All items are fully editable before saving.
        </div>
      )}
      {form.supplyOrderRef && !fromQuotation && (
        <div style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', marginBottom: 16, fontSize: 13 }}>
          🛒 Items loaded from Supply Order <strong style={{ color: '#818cf8' }}>{form.supplyOrderRef}</strong> — Add client details and save.
        </div>
      )}

      {/* ── Smart Source Loader: pull items from SO / PO / Quotation with markup ── */}
      {!fromQuotation && (
        <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 10 }}>
            📥 Load Items from Existing Document
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* Source type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Source Type</label>
              <select className="input" style={{ fontSize: 12 }} value={sourceType} onChange={e => { setSourceType(e.target.value); setSourceId('') }}>
                <option value="">— Select type —</option>
                <option value="quotation">📋 Quotation</option>
                <option value="supplyOrder">📦 Supply Order</option>
                <option value="purchase">🏭 Purchase Order</option>
              </select>
            </div>

            {/* Document picker */}
            {sourceType && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Select Document</label>
                <select className="input" style={{ fontSize: 12 }} value={sourceId} onChange={e => setSourceId(e.target.value)}>
                  <option value="">— Pick document —</option>
                  {sourceOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            )}

            {/* Markup % — only for vendor docs, not quotations */}
            {sourceType && sourceType !== 'quotation' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Markup %</label>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {[5, 10, 15, 20].map(p => (
                    <button key={p} onClick={() => setMarkupPct(p)}
                      style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                        background: markupPct === p ? 'var(--amber)' : 'transparent',
                        color: markupPct === p ? '#000' : 'var(--amber)',
                        border: '1px solid var(--amber)' }}>
                      +{p}%
                    </button>
                  ))}
                  <input type="number" className="input" min={0} max={500} step={0.5}
                    style={{ width: 72, fontWeight: 700, borderColor: 'var(--amber)', textAlign: 'center' }}
                    value={markupPct}
                    onChange={e => setMarkupPct(parseFloat(e.target.value) || 0)}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
            )}

            {/* Apply button */}
            {sourceType && (
              <button className="btn btn-primary" style={{ background: 'var(--amber)', borderColor: 'var(--amber)', color: '#000', fontWeight: 700, alignSelf: 'flex-end' }}
                onClick={applySource}>
                ✅ Apply
              </button>
            )}
          </div>

          {/* Markup preview — show what price conversion looks like */}
          {sourceType && sourceType !== 'quotation' && sourceId && (() => {
            const rec = sourceOptions.find(o => o.id === sourceId)?.record
            if (!rec?.items?.length) return null
            const markup = parseFloat(markupPct) || 0
            const first = rec.items[0]
            const base = parseFloat(first.marketPrice || first.costPrice || 0)
            const sell = parseFloat((base * (1 + markup / 100)).toFixed(2))
            return (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: 6 }}>
                e.g. <strong>{first.description}</strong>: cost <span style={{ color: 'var(--red)' }}>PKR {base.toLocaleString()}</span>
                → selling <span style={{ color: 'var(--green)', fontWeight: 700 }}>PKR {sell.toLocaleString()}</span>
                &nbsp;(+{markup}%)
              </div>
            )
          })()}
        </div>
      )}

      {/* Remaining qty card when editing existing invoice */}
      {initial && relatedDNs.length > 0 && (
        <RemainingQtyCard invoice={initial} deliveryNotes={data.deliveryNotes || []} />
      )}

      {/* Header */}
      <div className="section-box">
        <div className="section-title">🧾 Invoice Details</div>
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
              onContactSelect={contact => {
                if (contact?.phone) setField('clientContact', contact.phone)
                if (contact?.address) setField('clientAddress', contact.address)
              }}
              placeholder="Search or type client name..."
            />
            {form.accountHeadID && (
              <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 4, fontFamily: 'monospace' }}>
                Account: {form.accountHeadID}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Contact</label>
            <input className="input" value={form.clientContact} onChange={e => setField('clientContact', e.target.value)} placeholder="+92..." />
          </div>
          <div className="input-group col-span-3">
            <label className="input-label">Subject / Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(appears on PDF — e.g. "Books & Stationery Supply")</span></label>
            <input className="input" value={form.subject || ''} onChange={e => setField('subject', e.target.value)} placeholder="e.g. Uniform Supply — Phase 1 / Books & Stationery..." />
          </div>
          <div className="input-group col-span-3">
            <label className="input-label">Client Address</label>
            <input className="input" value={form.clientAddress || ''} onChange={e => setField('clientAddress', e.target.value)} placeholder="Client address (appears on PDF)" />
          </div>
          <div className="input-group">
            <label className="input-label">Invoice # (auto = INV-201, 202...)</label>
            <input className="input" value={form.number} onChange={e => setField('number', e.target.value)} placeholder="Auto-assigned on save" />
          </div>
          <div className="input-group">
            <label className="input-label">Invoice Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Due Date</label>
            <input type="date" className="input" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
              {['unpaid', 'partial', 'paid', 'cancelled'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          {form.quotationRef && (
            <div className="input-group">
              <label className="input-label">From Quotation</label>
              <input className="input" value={form.quotationRef} disabled style={{ opacity: 0.6 }} />
            </div>
          )}
          {form.supplyOrderRef && (
            <div className="input-group">
              <label className="input-label">From Supply Order</label>
              <input className="input" value={form.supplyOrderRef} disabled style={{ opacity: 0.6 }} />
            </div>
          )}
          {form.purchaseRef && (
            <div className="input-group">
              <label className="input-label">From Purchase Order</label>
              <input className="input" value={form.purchaseRef} disabled style={{ opacity: 0.6 }} />
            </div>
          )}
        </div>
      </div>

      {/* Items Table — fully inline editable */}
      <div className="section-box">
        <div className="section-title" style={{ marginBottom: 12 }}>
          📦 Line Items
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
            — Qty (blue) and Price (amber) cells are editable
          </span>
        </div>

        {/* Desktop table */}
        <div className="table-wrapper invoice-items-table">
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Description</th>
                <th style={{ width: 110, color: 'var(--text-muted)' }}>Color</th>
                <th style={{ textAlign: 'center', color: 'var(--blue)', width: 95 }}>Qty ✏️</th>
                <th style={{ color: 'var(--amber)', width: 135 }}>Unit Price ✏️</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No items — click "+ Add Row"
                </td></tr>
              )}
              {form.items.map((item, idx) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  index={idx}
                  onChange={(field, value) => updateItem(item.id, field, value)}
                  onDelete={() => deleteRow(item.id)}
                  onMatrixChange={rows => updateMatrix(item.id, rows)}
                />
              ))}
              <tr>
                <td colSpan={8} style={{ padding: '6px 8px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={addBlankRow} style={{ width: '100%' }}>
                    + Add Blank Row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile card layout (hidden on desktop via CSS) */}
        <div className="invoice-items-cards" style={{ display: 'none' }}>
          {form.items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No items — tap "+ Add Row"</div>
          )}
          {form.items.map((item, idx) => (
            <ItemCard
              key={item.id}
              item={item}
              index={idx}
              onChange={(field, value) => updateItem(item.id, field, value)}
              onDelete={() => deleteRow(item.id)}
              onMatrixChange={rows => updateMatrix(item.id, rows)}
            />
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addBlankRow} style={{ width: '100%', marginTop: 4 }}>
            + Add Item
          </button>
        </div>

        {/* Tax & Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <div style={{ minWidth: 310 }}>
            <div className="input-label" style={{ marginBottom: 6 }}>Tax Rate</div>
            <div className="tax-btns" style={{ marginBottom: 10 }}>
              {TAX_OPTIONS.map(t => (
                <button key={t.val} className={`tax-btn ${form.taxRate === t.val ? 'active' : ''}`}
                  onClick={() => setField('taxRate', t.val)}>{t.label}</button>
              ))}
            </div>
            {form.taxRate === -1 && (
              <input type="number" className="input" style={{ marginBottom: 10, width: 110 }}
                placeholder="Rate %" value={form.customTax} onChange={e => setField('customTax', e.target.value)} />
            )}

            <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 10 }}>
              {[
                ['Subtotal', subtotal, false, 'var(--text)'],
                [`Tax (${effectiveTax}%)`, taxAmount, false, 'var(--amber)'],
                ['TOTAL DUE', total, true, 'var(--green)'],
              ].map(([label, val, big, color]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: big ? '8px 0' : '4px 0', fontWeight: big ? 900 : 400, fontSize: big ? 17 : 13, borderTop: big ? '2px solid var(--glass-border)' : 'none', marginTop: big ? 6 : 0, color }}>
                  <span>{label}</span>
                  <span>PKR {val.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>

            <div className="divider" />
            <div className="input-group" style={{ marginBottom: 8 }}>
              <label className="input-label">Advance / Payment Received (PKR)</label>
              <input type="number" className="input" min="0" value={form.advancePaid}
                onChange={e => setField('advancePaid', e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: 16,
              color: balance > 0 ? 'var(--red)' : 'var(--green)',
              padding: '8px 0', borderTop: '2px solid var(--glass-border)' }}>
              <span>BALANCE DUE</span>
              <span>PKR {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="inv-stealth" checked={form.stealthPrint} onChange={e => setField('stealthPrint', e.target.checked)} />
              <label htmlFor="inv-stealth" style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>
                🥷 Stealth Print (hide totals in PDF)
              </label>
            </div>
          </div>
        </div>

        <div className="input-group" style={{ marginTop: 14 }}>
          <label className="input-label">📝 Notes / Terms <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(printed at bottom of PDF)</span></label>
          <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} spellCheck
            placeholder="e.g. Payment due within 30 days. Goods once sold are not returnable." />
        </div>

        <Attachments refId={initial?.id} refType="invoice" uploadedBy={currentUser?.name} />

        {/* Read-only attachments from source Quotation */}
        {(initial?.quotationId || form.quotationId) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
              📋 Attachments from Quotation {form.quotationRef} (view only)
            </div>
            <Attachments refId={initial?.quotationId || form.quotationId} refType="quotation" readOnly={true} uploadedBy={currentUser?.name} />
          </div>
        )}

        {/* Read-only attachments from source Supply Order */}
        {(initial?.supplyOrderId || form.supplyOrderId) && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
              🛒 Attachments from Supply Order {form.supplyOrderRef} (view only)
            </div>
            <Attachments refId={initial?.supplyOrderId || form.supplyOrderId} refType="supply-order" readOnly={true} uploadedBy={currentUser?.name} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {/* Delivery note button — only if editing a saved invoice */}
          {initial?.number && (
            <button className="btn btn-secondary" onClick={() => onOpenDN && onOpenDN(initial)}
              style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
              🚚 Generate Delivery Note
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-secondary" onClick={() => {
            const num = form.number || `INV-${Date.now().toString().slice(-3)}`
            exportInvoicePDF({ ...form, number: num, subtotal, taxAmount, total, taxRate: effectiveTax }, form.stealthPrint, currentCompany)
          }}>🖨️ Preview PDF</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={saving ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>
            {saving ? '⏳ Saving…' : '💾 Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Invoice List ────────────────────────────────────────────────────────
export default function Invoices() {
  const { data, addRecord, updateRecord, deleteRecord, currentCompany, currentCompanyId, refreshData, nextDocNumber } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [fromQuotation, setFromQuotation] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [dnModal, setDnModal] = useState(null)
  const [payInvoice, setPayInvoice] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))

  // Pick up any pending quotation conversion navigated from Quotations page
  useEffect(() => {
    const pending = sessionStorage.getItem('tat_convert_quote')
    if (pending) {
      try {
        const q = JSON.parse(pending)
        sessionStorage.removeItem('tat_convert_quote')
        setFromQuotation(q)
        setSelected(null)
        setView('convert')
      } catch (_) {}
    }
  }, [])

  // Pick up Supply Order → Invoice navigation
  const [fromSO, setFromSO] = useState(null)
  useEffect(() => {
    // Open existing linked invoice (smart link from SO)
    const openRef = sessionStorage.getItem('tat_open_invoice_ref')
    if (openRef) {
      sessionStorage.removeItem('tat_open_invoice_ref')
      const found = (data.invoices || []).find(inv => inv.number === openRef)
      if (found) { setSelected(found); setView('edit') }
      return
    }
    const pending = sessionStorage.getItem('tat_so_to_invoice')
    if (pending) {
      try {
        const so = JSON.parse(pending)
        sessionStorage.removeItem('tat_so_to_invoice')
        setFromSO(so)
        setSelected(null)
        setView('new')
      } catch (_) {}
    }
  }, [])

  const availableMonths = useMemo(() => {
    const seen = new Set()
    for (const i of (data.invoices || [])) { const m = (i.date || i.createdAt || '').slice(0,7); if (m) seen.add(m) }
    return [...seen].sort((a,b) => b.localeCompare(a))
  }, [data.invoices])

  const invoices = useMemo(() => {
    let list = data.invoices || []
    if (monthFilter !== 'all') list = list.filter(i => (i.date || i.createdAt || '').slice(0,7) === monthFilter)
    if (search) list = list.filter(i =>
      i.clientName?.toLowerCase().includes(search.toLowerCase()) || i.number?.includes(search)
    )
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
    return list
  }, [data.invoices, search, statusFilter])

  const handleSave = async (f) => {
    const loadId = toast.loading('Saving invoice…')
    try {
      if (selected) {
        const r = await fetch(`/api/invoices/${selected.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(f),
        })
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Server error') }
        updateRecord('invoices', selected.id, f)
        toast.dismiss(loadId)
        toast.success(`Invoice ${f.number} updated!`)
      } else {
        const res = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...f, id: Date.now().toString(), createdAt: new Date().toISOString(), companyId: currentCompanyId }),
        })
        const saved = await res.json()
        if (!res.ok) throw new Error(saved.error || 'Server error')
        if (fromQuotation) {
          await fetch(`/api/quotations/${fromQuotation.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'invoiced' }),
          })
          updateRecord('quotations', fromQuotation.id, { status: 'invoiced' })
        }
        await refreshData()
        toast.dismiss(loadId)
        toast.success(`Invoice ${saved.number || f.number} created!`)
      }
      setView('list'); setSelected(null); setFromQuotation(null)
    } catch (err) {
      toast.dismiss(loadId)   // always clear the loading spinner
      throw err               // re-throw so InvoiceForm.handleSave shows the error toast
    }
  }

  const handleGenerateDN = async (dnData) => {
    const num = await nextDocNumber('dn')
    addRecord('deliveryNotes', { ...dnData, number: num })
    toast.success(`Delivery Note ${num} created!`)
    setDnModal(null)
  }

  // Convert invoice items → Supply Order in one click
  const convertToSO = async (inv) => {
    const loadId = toast.loading('Creating Supply Order…')
    try {
      const num = await nextDocNumber('so')
      const soItems = (inv.items || []).map(item => ({
        id: Date.now() + Math.random(),
        description: item.description || '',
        color: item.color || '',
        qty: item.useMatrix ? calcMatrixTotal(item.matrixRows || []) : (parseInt(item.qty) || 1),
        marketPrice: parseFloat(item.unitPrice) || 0,
        useMatrix: false,
        matrixRows: [],
        note: '',
      }))
      const res = await fetch('/api/supplyOrders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now().toString(),
          number: num,
          title: `${inv.number} — ${inv.clientName}`,
          supplierName: '', supplierContact: '', accountHeadID: '',
          date: new Date().toISOString().slice(0, 10),
          items: soItems,
          notes: `Auto-created from Invoice ${inv.number}`,
          status: 'pending', priority: 'normal',
          sourceRef: inv.number, sourceType: 'invoice',
          companyId: currentCompanyId,
          createdAt: new Date().toISOString(),
        }),
      })
      if (!res.ok) throw new Error('Server error')
      await refreshData()
      toast.dismiss(loadId)
      toast.success(`✅ Supply Order ${num} created from ${inv.number}!`, { duration: 5000 })
    } catch (err) {
      toast.dismiss(loadId)
      toast.error(`Failed: ${err.message || 'Check connection'}`)
    }
  }

  // Summary totals
  const totals = invoices.reduce((acc, i) => ({
    total: acc.total + (i.total || 0),
    paid: acc.paid + (i.advancePaid || 0)
  }), { total: 0, paid: 0 })

  if (view !== 'list') {
    const title = view === 'convert'
      ? `📋 Convert ${fromQuotation?.number} → Invoice`
      : selected ? 'Edit Invoice' : 'New Invoice'
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>🧾 <span>{title}</span></h2>
          <button className="btn btn-secondary btn-sm"
            onClick={() => { setView('list'); setSelected(null); setFromQuotation(null) }}>
            ← Back to List
          </button>
        </div>
        <InvoiceForm
          initial={selected || (fromSO ? {
            supplyOrderRef: fromSO.supplyOrderRef,
            supplyOrderId: fromSO.supplyOrderId,
            items: fromSO.items,
            notes: fromSO.notes,
            clientName: '', clientContact: '', accountHeadID: '',
            date: new Date().toISOString().slice(0, 10),
            dueDate: '', taxRate: 0, advancePaid: 0, status: 'unpaid', stealthPrint: false,
          } : null)}
          fromQuotation={fromQuotation}
          onSave={handleSave}
          onCancel={() => { setView('list'); setSelected(null); setFromQuotation(null); setFromSO(null) }}
          onOpenDN={(inv) => setDnModal(inv)}
        />
        {dnModal && (
          <GenerateDNModal
            invoice={dnModal}
            existingDNs={(data.deliveryNotes || []).filter(dn => dn.invoiceRef === dnModal.number)}
            onGenerate={handleGenerateDN}
            onCancel={() => setDnModal(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🧾 <span>Invoices</span></h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Quick convert from approved quotation */}
          {(data.quotations || []).some(q => q.status === 'approved') && (
            <select className="input" style={{ maxWidth: 230 }} defaultValue=""
              onChange={e => {
                if (!e.target.value) return
                const q = (data.quotations || []).find(q => q.id === e.target.value)
                if (q) { setFromQuotation(q); setSelected(null); setView('convert') }
                e.target.value = ''
              }}>
              <option value="">📋 Convert Approved Quote →</option>
              {(data.quotations || []).filter(q => q.status === 'approved').map(q => (
                <option key={q.id} value={q.id}>{q.number} — {q.clientName}</option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={() => { setSelected(null); setFromQuotation(null); setView('new') }}>
            + New Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <div className="stat-card card-blue">
          <div className="label">📊 Total Invoiced</div>
          <div className="value" style={{ fontSize: 18 }}>PKR {totals.total.toLocaleString()}</div>
          <div className="sub">{invoices.length} invoice(s)</div>
        </div>
        <div className="stat-card card-green">
          <div className="label">✅ Advance Received</div>
          <div className="value" style={{ fontSize: 18 }}>PKR {totals.paid.toLocaleString()}</div>
        </div>
        <div className="stat-card card-red">
          <div className="label">⚠️ Balance Outstanding</div>
          <div className="value" style={{ fontSize: 18 }}>PKR {(totals.total - totals.paid).toLocaleString()}</div>
        </div>
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 240 }} placeholder="🔍 Search client or invoice #..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 150 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All Months</option>
          {availableMonths.map(m => { const [y,mo]=m.split('-'); return <option key={m} value={m}>{new Date(+y,+mo-1).toLocaleString('default',{month:'long',year:'numeric'})}</option> })}
        </select>
        <select className="input" style={{ maxWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          {['unpaid', 'partial', 'paid', 'cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Client</th>
              <th>Subject / Items</th>
              <th>Date</th>
              <th>Due</th>
              <th>Total</th>
              <th>Advance</th>
              <th>Balance</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                No invoices yet. Create one or approve a quotation.
              </td></tr>
            )}
            {invoices.map(inv => {
              const bal = (inv.total || 0) - (inv.advancePaid || 0)
              const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'paid'
              // Delivery status
              const relatedDNs = (data.deliveryNotes || []).filter(dn => dn.invoiceRef === inv.number)
              const totalInvQty = (inv.items || []).reduce((s, i) => s + (parseInt(i.qty) || 0), 0)
              const deliveredQty = relatedDNs.reduce((s, dn) => s + (dn.items || []).reduce((a, i) => a + (parseInt(i.qty) || 0), 0), 0)
              const remainingQty = totalInvQty - deliveredQty

              return (
                <tr key={inv.id}>
                  <td className="font-mono" style={{ color: 'var(--red)', fontSize: 13, fontWeight: 800 }}>{inv.number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inv.clientName}</div>
                    {inv.quotationRef && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ref: {inv.quotationRef}</div>}
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    {(inv.subject || inv.title) && <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{inv.subject || inv.title}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {(inv.items || []).slice(0, 2).map((i, idx) => <span key={idx}>{i.description}{idx < Math.min((inv.items||[]).length,2)-1 ? ', ' : ''}</span>)}
                      {(inv.items||[]).length > 2 && <span> +{(inv.items||[]).length - 2} more</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>{inv.date}</td>
                  <td style={{ fontSize: 12, color: isOverdue ? 'var(--red)' : 'inherit', fontWeight: isOverdue ? 700 : 400 }}>
                    {inv.dueDate || '—'}{isOverdue && ' ⚠️'}
                  </td>
                  <td className="bold" style={{ whiteSpace: 'nowrap' }}>PKR {Number(inv.total || 0).toLocaleString()}</td>
                  <td className="text-green" style={{ whiteSpace: 'nowrap' }}>PKR {Number(inv.advancePaid || 0).toLocaleString()}</td>
                  <td className={bal > 0 ? 'text-red bold' : 'text-green bold'} style={{ whiteSpace: 'nowrap' }}>
                    PKR {bal.toLocaleString()}
                  </td>
                  {/* Delivery remaining mini card */}
                  <td>
                    {relatedDNs.length === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None</span>
                    ) : remainingQty <= 0 ? (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', fontWeight: 700 }}>✅ Done</span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.15)', color: 'var(--amber)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {remainingQty} rem.
                      </span>
                    )}
                  </td>
                  <td>
                    {/* Status dropdown — paid/partial opens payment modal (Rule 3); others need master code */}
                    <select
                      className={`badge badge-${inv.status}`}
                      value={inv.status}
                      style={{ cursor: 'pointer', border: 'none', background: 'transparent', fontWeight: 700, fontSize: 11, padding: '3px 6px', borderRadius: 6 }}
                      onChange={e => {
                        const newStatus = e.target.value
                        if (newStatus === inv.status) return
                        e.target.value = inv.status // reset visually
                        if (newStatus === 'paid' || newStatus === 'partial') {
                          // Rule 3: open payment modal instead of blindly setting status
                          setPayInvoice(inv)
                        } else {
                          setMasterAction({ type: 'status', id: inv.id, newStatus, number: inv.number })
                        }
                      }}
                    >
                      {['unpaid', 'partial', 'paid', 'cancelled'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-xs" title="Edit"
                        onClick={() => setMasterAction({ type: 'edit', item: inv })}>✏️</button>
                      <button className="btn btn-danger btn-xs" title="Delete"
                        onClick={() => setMasterAction({ type: 'delete', id: inv.id })}>🗑️</button>
                      <button className="btn btn-secondary btn-xs" title="Print PDF"
                        onClick={() => exportInvoicePDF(inv, inv.stealthPrint, currentCompany)}>📄</button>
                      <button className="btn btn-secondary btn-xs" title="Generate Delivery Note"
                        onClick={() => setDnModal(inv)}
                        style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
                        🚚
                      </button>
                      {bal > 0 && (
                        <button className="btn btn-secondary btn-xs" title="Receive Payment"
                          onClick={() => setPayInvoice(inv)}
                          style={{ borderColor: 'var(--green)', color: 'var(--green)', fontWeight: 700 }}>
                          💰 Pay
                        </button>
                      )}
                      <button className="btn btn-secondary btn-xs" title="Convert to Supply Order"
                        onClick={() => convertToSO(inv)}
                        style={{ borderColor: 'var(--blue)', color: 'var(--blue)', whiteSpace: 'nowrap' }}>
                        🛒 SO
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Delivery Note modal from list */}
      {dnModal && (
        <GenerateDNModal
          invoice={dnModal}
          existingDNs={(data.deliveryNotes || []).filter(dn => dn.invoiceRef === dnModal.number)}
          onGenerate={handleGenerateDN}
          onCancel={() => setDnModal(null)}
        />
      )}

      {payInvoice && (
        <UniversalPaymentModal
          direction="inbound"
          docNumber={payInvoice.number}
          partyName={payInvoice.clientName}
          total={payInvoice.total || 0}
          alreadyPaid={payInvoice.advancePaid || 0}
          apiEndpoint={`/api/invoices/${payInvoice.id}/payment`}
          onClose={() => setPayInvoice(null)}
          onSuccess={async () => {
            setPayInvoice(null)
            await refreshData()
            try {
              const res = await fetch(`/api/delivery-notes/sync-check?invoiceRef=${encodeURIComponent(payInvoice.number)}`)
              if (res.ok) {
                const { allDelivered, dnCount } = await res.json()
                if (allDelivered && dnCount > 0) toast.success(`All ${dnCount} delivery note(s) for ${payInvoice.number} auto-marked as delivered.`)
              }
            } catch (_) {}
          }}
        />
      )}

      {/* Master Code gate */}
      {masterAction && (
        <MasterCodeModal
          title={
            masterAction.type === 'delete' ? 'Confirm Delete' :
            masterAction.type === 'status' ? `Change Status → ${masterAction.newStatus}` :
            'Confirm Edit'
          }
          onSuccess={() => {
            if (masterAction.type === 'delete') {
              deleteRecord('invoices', masterAction.id)
              toast.success('Invoice deleted.')
            } else if (masterAction.type === 'status') {
              updateRecord('invoices', masterAction.id, { status: masterAction.newStatus })
              toast.success(`${masterAction.number} → ${masterAction.newStatus}`)
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
