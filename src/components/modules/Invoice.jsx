import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import { exportInvoicePDF } from '../../utils/pdfExport'
import { calcExpr } from '../../utils/calcExpr'
import toast from 'react-hot-toast'

const TAX_OPTIONS = [
  { label: 'No Tax', val: 0 },
  { label: '5.5%', val: 5.5 },
  { label: '15%', val: 15 },
  { label: '18%', val: 18 },
  { label: 'Custom', val: -1 },
]

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
function ItemRow({ item, index, onChange, onDelete }) {
  const amount = (parseInt(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)
  return (
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
      <td style={{ width: 95 }}>
        <QtyInput value={item.qty} onChange={v => onChange('qty', v)} onBlur={v => onChange('qty', v)} style={{ width: 82, padding: '6px 8px' }} />
      </td>
      <td style={{ width: 135 }}>
        <PriceInput value={item.unitPrice} onChange={v => onChange('unitPrice', v)} onBlur={v => onChange('unitPrice', v)} style={{ padding: '6px 8px 6px 34px' }} />
      </td>
      <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--green)', paddingRight: 12, whiteSpace: 'nowrap', fontSize: 13 }}>
        PKR {amount.toLocaleString()}
      </td>
      <td style={{ width: 36, textAlign: 'center' }}>
        <button className="btn btn-danger btn-xs" onClick={onDelete} title="Remove row" style={{ padding: '3px 8px' }}>✕</button>
      </td>
    </tr>
  )
}

// ─── Mobile Card (stacked layout) ───────────────────────────────────────────
function ItemCard({ item, index, onChange, onDelete }) {
  const amount = (parseInt(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)
  return (
    <div style={{ padding: '12px 14px', borderRadius: 10, border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.03)', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Item {index + 1}</span>
        <button className="btn btn-danger btn-xs" onClick={onDelete} style={{ padding: '4px 10px' }}>✕ Remove</button>
      </div>
      <div className="input-group" style={{ marginBottom: 10 }}>
        <label className="input-label">Description</label>
        <input className="input" value={item.description} onChange={e => onChange('description', e.target.value)}
          placeholder="Item description" spellCheck style={{ fontSize: 16 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--blue)', fontWeight: 700 }}>QTY ✏️</label>
          <QtyInput value={item.qty} onChange={v => onChange('qty', v)} onBlur={v => onChange('qty', v)}
            style={{ padding: '12px 10px', fontSize: 20, width: '100%' }} />
        </div>
        <div className="input-group">
          <label className="input-label" style={{ color: 'var(--amber)', fontWeight: 700 }}>UNIT PRICE ✏️</label>
          <PriceInput value={item.unitPrice} onChange={v => onChange('unitPrice', v)} onBlur={v => onChange('unitPrice', v)}
            style={{ padding: '12px 10px 12px 34px', fontSize: 20 }} />
        </div>
      </div>
      <div style={{ textAlign: 'right', fontWeight: 900, color: 'var(--green)', fontSize: 16 }}>
        Amount: PKR {amount.toLocaleString()}
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

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-lg fade-in" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">🚚 Generate Delivery Note from {invoice.number}</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Adjust delivery quantities — remaining qty is pre-filled based on previous deliveries.
        </p>

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
              </tr>
            </thead>
            <tbody>
              {dnItems.map(item => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{item.description}</td>
                  <td style={{ textAlign: 'center' }}>{item.invoicedQty}</td>
                  <td style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>{item.delivered}</td>
                  <td style={{ textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{item.invoicedQty - item.delivered}</td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 90, borderColor: 'var(--amber)', background: 'rgba(245,158,11,0.1)', textAlign: 'center', fontWeight: 800 }}
                      min="0"
                      max={item.invoicedQty - item.delivered}
                      value={item.dnQty}
                      onChange={e => setDnItems(prev => prev.map(i => i.id === item.id ? { ...i, dnQty: e.target.value } : i))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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
  const { data, nextInvoiceNumber } = useApp()
  const [form, setForm] = useState(() => {
    if (fromQuotation) {
      return {
        number: '',
        quotationRef: fromQuotation.number,
        quotationId: fromQuotation.id,
        accountHeadID: fromQuotation.accountHeadID || '',
        clientName: fromQuotation.clientName || '',
        clientContact: fromQuotation.clientContact || '',
        date: new Date().toISOString().slice(0, 10),
        dueDate: '',
        items: (fromQuotation.items || []).map(i => ({
          id: Date.now() + Math.random(),
          description: i.description || '',
          qty: i.useMatrix
            ? (i.matrixRows || []).reduce((s, r) => s + Object.values(r.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0), 0)
            : (parseInt(i.qty) || 1),
          unitPrice: parseFloat(i.unitPrice) || 0,
        })),
        taxRate: fromQuotation.taxRate || 0,
        customTax: '',
        advancePaid: 0,
        notes: fromQuotation.notes || '',
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
      date: new Date().toISOString().slice(0, 10),
      dueDate: '',
      items: [{ id: Date.now(), description: '', qty: 1, unitPrice: 0 }],
      taxRate: 0,
      customTax: '',
      advancePaid: 0,
      notes: '',
      stealthPrint: false,
      status: 'unpaid',
    }
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const updateItem = useCallback((id, field, value) => {
    setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [field]: value } : i) }))
  }, [])

  const addBlankRow = () => setForm(f => ({
    ...f, items: [...f.items, { id: Date.now(), description: '', qty: 1, unitPrice: 0 }]
  }))

  const deleteRow = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))

  const effectiveTax = form.taxRate === -1 ? parseFloat(form.customTax || 0) : (form.taxRate || 0)
  const subtotal = form.items.reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)
  const taxAmount = subtotal * effectiveTax / 100
  const total = subtotal + taxAmount
  const balance = total - (parseFloat(form.advancePaid) || 0)

  const handleSave = () => {
    if (!form.clientName) { toast.error('Client name required.'); return }
    if (form.items.length === 0) { toast.error('Add at least one item.'); return }
    const num = form.number || nextInvoiceNumber()
    onSave({ ...form, number: num, subtotal, taxAmount, total, taxRate: effectiveTax })
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
        </div>
      </div>

      {/* Items Table — fully inline editable */}
      <div className="section-box">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            📦 Line Items
            <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 10 }}>
              — Qty (blue) and Price (amber) cells are editable
            </span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addBlankRow}>+ Add Row</button>
        </div>

        {/* Desktop table */}
        <div className="table-wrapper invoice-items-table">
          <table style={{ minWidth: 560 }}>
            <thead>
              <tr>
                <th style={{ width: 32 }}>#</th>
                <th>Description</th>
                <th style={{ textAlign: 'center', color: 'var(--blue)', width: 95 }}>Qty ✏️</th>
                <th style={{ color: 'var(--amber)', width: 135 }}>Unit Price ✏️</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
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
                />
              ))}
              <tr>
                <td colSpan={6} style={{ padding: '6px 8px' }}>
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
          <label className="input-label">Notes</label>
          <textarea className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={2} spellCheck />
        </div>
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
            exportInvoicePDF({ ...form, number: num, subtotal, taxAmount, total, taxRate: effectiveTax }, form.stealthPrint)
          }}>🖨️ Preview PDF</button>
          <button className="btn btn-primary" onClick={handleSave}>💾 Save Invoice</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Invoice List ────────────────────────────────────────────────────────
export default function Invoices() {
  const { data, addRecord, updateRecord, deleteRecord } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [fromQuotation, setFromQuotation] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [dnModal, setDnModal] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const invoices = useMemo(() => {
    let list = data.invoices || []
    if (search) list = list.filter(i =>
      i.clientName?.toLowerCase().includes(search.toLowerCase()) || i.number?.includes(search)
    )
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter)
    return list
  }, [data.invoices, search, statusFilter])

  const handleSave = (f) => {
    if (selected) {
      updateRecord('invoices', selected.id, f)
      toast.success(`Invoice ${f.number} updated!`)
    } else {
      addRecord('invoices', f)
      if (fromQuotation) {
        updateRecord('quotations', fromQuotation.id, { status: 'invoiced' })
      }
      toast.success(`Invoice ${f.number} created!`)
    }
    setView('list'); setSelected(null); setFromQuotation(null)
  }

  const handleGenerateDN = (dnData) => {
    const num = `DN-${Date.now().toString().slice(-5)}`
    addRecord('deliveryNotes', { ...dnData, number: num })
    toast.success(`Delivery Note ${num} created!`)
    setDnModal(null)
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
          initial={selected}
          fromQuotation={fromQuotation}
          onSave={handleSave}
          onCancel={() => { setView('list'); setSelected(null); setFromQuotation(null) }}
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
        <input className="input" style={{ maxWidth: 300 }} placeholder="🔍 Search client or invoice #..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
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
                  <td><span className={`badge badge-${inv.status}`}>{inv.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary btn-xs" title="Edit"
                        onClick={() => setMasterAction({ type: 'edit', item: inv })}>✏️</button>
                      <button className="btn btn-danger btn-xs" title="Delete"
                        onClick={() => setMasterAction({ type: 'delete', id: inv.id })}>🗑️</button>
                      <button className="btn btn-secondary btn-xs" title="Print PDF"
                        onClick={() => exportInvoicePDF(inv, inv.stealthPrint)}>📄</button>
                      <button className="btn btn-secondary btn-xs" title="Generate Delivery Note"
                        onClick={() => setDnModal(inv)}
                        style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
                        🚚
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

      {/* Master Code gate */}
      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'delete' ? 'Confirm Delete' : 'Confirm Edit'}
          onSuccess={() => {
            if (masterAction.type === 'delete') {
              deleteRecord('invoices', masterAction.id)
              toast.success('Invoice deleted.')
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
