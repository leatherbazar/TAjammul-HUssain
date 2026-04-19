import React, { useState, useMemo, useRef, useCallback } from 'react'
import { useApp } from '../../context/AppContext'
import ContactSelect from '../common/ContactSelect'
import MasterCodeModal from '../common/MasterCodeModal'
import toast from 'react-hot-toast'

// ─── Product Search (from Inventory) ─────────────────────────────────────────
function ProductSearch({ value, onChange, onSelect, placeholder }) {
  const [query, setQuery]     = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen]       = useState(false)
  const timerRef              = useRef(null)

  const search = useCallback((q) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      if (!q.trim()) { setResults([]); setOpen(false); return }
      try {
        const res  = await fetch(`/api/inventory/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.items || [])
        setOpen(true)
      } catch {}
    }, 200)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); search(e.target.value) }}
        placeholder={placeholder || 'Search item from inventory…'}
        onFocus={() => { if (query) search(query) }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 8, maxHeight: 260, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {results.map(item => {
            const isLow = item.qty <= (item.minStock || 0)
            return (
              <div
                key={item.id}
                style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)' }}
                onMouseDown={() => { setQuery(item.name); onSelect(item); setOpen(false) }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.qty === 0 ? 'var(--red)' : isLow ? 'var(--amber)' : 'var(--green)', fontFamily: 'Orbitron, sans-serif' }}>
                    {item.qty} {item.unit}
                    {item.qty === 0 && ' ⚠️'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 14, marginTop: 2, flexWrap: 'wrap' }}>
                  <span>SKU: {item.sku || '—'}</span>
                  <span>Category: {item.category || '—'}</span>
                  <span style={{ color: 'var(--amber)' }}>Cost: PKR {Number(item.costPrice || 0).toLocaleString()}</span>
                  <span style={{ color: 'var(--green)' }}>Sell: PKR {Number(item.sellPrice || 0).toLocaleString()}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {open && results.length === 0 && query.trim() && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
          background: 'var(--card-bg)', border: '1px solid var(--glass-border)',
          borderRadius: 8, padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13,
        }}>
          No items found for "{query}"
        </div>
      )}
    </div>
  )
}

// ─── Sale Form ────────────────────────────────────────────────────────────────
function SaleForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState(initial || {
    clientName: '', clientContact: '', accountHeadID: '',
    date: today, notes: '', taxRate: 0, paidAmount: 0, paymentStatus: 'unpaid',
    items: [{
      id: Date.now(), inventoryId: '', description: '', color: '', unit: 'pcs',
      qty: 1, costPrice: 0, salePrice: 0, stockAvail: 0,
    }],
  })
  const [saving, setSaving] = useState(false)

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, {
      id: Date.now(), inventoryId: '', description: '', color: '', unit: 'pcs',
      qty: 1, costPrice: 0, salePrice: 0, stockAvail: 0,
    }],
  }))

  const removeItem = id => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))

  const updateItem = (id, k, v) => setForm(f => ({
    ...f,
    items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i),
  }))

  const selectProduct = (itemId, product) => {
    setForm(f => ({
      ...f,
      items: f.items.map(i => i.id === itemId ? {
        ...i,
        inventoryId:  product.id,
        description:  product.name,
        color:        product.color || '',
        unit:         product.unit || 'pcs',
        costPrice:    product.costPrice || 0,
        salePrice:    product.sellPrice || 0,
        stockAvail:   product.qty || 0,
      } : i),
    }))
  }

  // Totals
  const subtotal    = form.items.reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.salePrice) || 0), 0)
  const totalCost   = form.items.reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.costPrice) || 0), 0)
  const taxAmount   = +(subtotal * (parseFloat(form.taxRate) || 0) / 100).toFixed(2)
  const total       = subtotal + taxAmount
  const profit      = subtotal - totalCost
  const marginPct   = subtotal > 0 ? +((profit / subtotal) * 100).toFixed(1) : 0
  const paidAmount  = parseFloat(form.paidAmount) || 0
  const balance     = total - paidAmount

  const payStatus = paidAmount >= total ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid'

  const handleSave = async () => {
    if (!form.clientName) { toast.error('Client name required.'); return }
    if (form.items.some(i => !i.description)) { toast.error('All items need a product.'); return }
    if (form.items.some(i => (parseInt(i.qty) || 0) <= 0)) { toast.error('All quantities must be > 0.'); return }
    setSaving(true)
    try {
      await onSave({ ...form, paymentStatus: payStatus })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Client Details */}
      <div className="section-box">
        <div className="section-title">🧑‍💼 Client Details</div>
        <div className="form-grid form-grid-3">
          <div className="input-group col-span-2">
            <label className="input-label">Client *</label>
            <ContactSelect
              type="client"
              value={form.clientName}
              onChange={(name, contact) => {
                setField('clientName', name)
                if (contact) setField('accountHeadID', contact.accountHeadID || '')
              }}
              onContactSelect={c => { if (c?.phone) setField('clientContact', c.phone) }}
              placeholder="Search client…"
            />
            {form.accountHeadID && (
              <div style={{ fontSize: 11, color: 'var(--green)', marginTop: 3, fontFamily: 'monospace' }}>{form.accountHeadID}</div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Contact</label>
            <input className="input" value={form.clientContact} onChange={e => setField('clientContact', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Sale Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Tax %</label>
            <input type="number" className="input" min="0" max="100" value={form.taxRate}
              onChange={e => setField('taxRate', e.target.value)} />
          </div>
          <div className="input-group col-span-1">
            <label className="input-label">Notes</label>
            <input className="input" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Any remarks…" />
          </div>
        </div>
      </div>

      {/* Sale Items */}
      <div className="section-box">
        <div className="section-title">🛍️ Items Sold</div>

        {form.items.map((item, idx) => {
          const lineTotal  = (parseInt(item.qty) || 0) * (parseFloat(item.salePrice) || 0)
          const lineCost   = (parseInt(item.qty) || 0) * (parseFloat(item.costPrice) || 0)
          const lineProfit = lineTotal - lineCost
          const lineMargin = lineTotal > 0 ? +((lineProfit / lineTotal) * 100).toFixed(1) : 0
          const stockWarn  = item.inventoryId && item.stockAvail !== undefined && (parseInt(item.qty) || 0) > item.stockAvail

          return (
            <div key={item.id} style={{ marginBottom: 14, padding: 14, borderRadius: 10, border: `1px solid ${stockWarn ? 'rgba(220,38,38,0.5)' : 'var(--glass-border)'}`, background: 'rgba(255,255,255,0.02)' }}>
              {/* Product search row */}
              <div className="form-grid">
                <div className="input-group" style={{ gridColumn: 'span 3' }}>
                  <label className="input-label">
                    Product #{idx + 1}
                    {item.inventoryId && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                        In stock: <strong style={{ color: item.stockAvail === 0 ? 'var(--red)' : 'var(--green)' }}>{item.stockAvail} {item.unit}</strong>
                      </span>
                    )}
                  </label>
                  <ProductSearch
                    value={item.description}
                    onChange={v => updateItem(item.id, 'description', v)}
                    onSelect={product => selectProduct(item.id, product)}
                    placeholder="Search inventory…"
                  />
                  {stockWarn && (
                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>
                      ⚠️ Selling {item.qty} but only {item.stockAvail} in stock!
                    </div>
                  )}
                </div>

                <div className="input-group">
                  <label className="input-label">Qty</label>
                  <input type="number" className="input" min="1" value={item.qty}
                    onChange={e => updateItem(item.id, 'qty', e.target.value)}
                    style={{ borderColor: stockWarn ? 'var(--red)' : undefined }} />
                </div>
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <input className="input" list="unit-list-s" value={item.unit}
                    onChange={e => updateItem(item.id, 'unit', e.target.value)} />
                  <datalist id="unit-list-s">
                    {['pcs', 'sqt', 'meters', 'kg', 'pairs', 'sets', 'dozen'].map(u => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div className="input-group">
                  <label className="input-label">Color</label>
                  <input className="input" value={item.color} onChange={e => updateItem(item.id, 'color', e.target.value)} placeholder="optional" />
                </div>
              </div>

              {/* Pricing row */}
              <div className="form-grid" style={{ marginTop: 10 }}>
                <div className="input-group">
                  <label className="input-label">Cost Price (PKR)</label>
                  <input type="number" className="input" min="0" value={item.costPrice}
                    onChange={e => updateItem(item.id, 'costPrice', e.target.value)}
                    style={{ borderColor: 'rgba(251,191,36,0.4)' }} />
                </div>
                <div className="input-group">
                  <label className="input-label" style={{ color: 'var(--green)' }}>Sale Price (PKR) *</label>
                  <input type="number" className="input" min="0" value={item.salePrice}
                    onChange={e => updateItem(item.id, 'salePrice', e.target.value)}
                    style={{ borderColor: 'rgba(34,197,94,0.4)', fontWeight: 700 }} />
                </div>
                <div className="input-group">
                  <label className="input-label">Line Total</label>
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--glass-border)', fontWeight: 700, color: 'var(--blue)' }}>
                    PKR {lineTotal.toLocaleString()}
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Profit / Margin</label>
                  <div style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--glass-border)', fontWeight: 700, color: lineProfit >= 0 ? 'var(--green)' : 'var(--red)', display: 'flex', gap: 8 }}>
                    <span>PKR {lineProfit.toLocaleString()}</span>
                    <span style={{ opacity: 0.7 }}>({lineMargin}%)</span>
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
      </div>

      {/* Payment & Totals */}
      <div className="section-box">
        <div className="section-title">💰 Payment Summary</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: totals breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Subtotal', value: subtotal, color: 'var(--text)' },
              { label: `Tax (${form.taxRate || 0}%)`, value: taxAmount, color: 'var(--text-muted)' },
              { label: 'TOTAL', value: total, color: 'var(--blue)', big: true },
              { label: 'Total Cost', value: totalCost, color: 'var(--amber)' },
              { label: `Gross Profit (${marginPct}%)`, value: profit, color: profit >= 0 ? 'var(--green)' : 'var(--red)', big: true },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: row.big ? 900 : 700, fontSize: row.big ? 16 : 14, color: row.color, fontFamily: row.big ? 'Orbitron, sans-serif' : undefined }}>
                  PKR {Number(row.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Right: payment input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="input-group">
              <label className="input-label">Amount Received (PKR)</label>
              <input type="number" className="input" min="0" value={form.paidAmount}
                onChange={e => setField('paidAmount', e.target.value)} />
            </div>
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Balance Due</div>
              <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>
                PKR {Math.abs(balance).toLocaleString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['unpaid', 'partial', 'paid'].map(s => (
                <button
                  key={s}
                  className={`btn btn-sm ${payStatus === s ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ textTransform: 'capitalize', flex: 1 }}
                  onClick={() => {
                    if (s === 'paid') setField('paidAmount', total)
                    else if (s === 'unpaid') setField('paidAmount', 0)
                  }}
                >
                  {s === 'paid' ? '✅' : s === 'partial' ? '🔄' : '❌'} {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? '⏳ Saving…' : '💾 Confirm Sale'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Sales Module ────────────────────────────────────────────────────────
export default function Sales() {
  const { data, deleteRecord, refreshData } = useApp()
  const [view, setView]             = useState('list')
  const [selected, setSelected]     = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [search, setSearch]         = useState('')
  const [accountHeads, setAccountHeads] = useState(null)

  // Load account heads on mount
  useState(() => {
    fetch('/api/account-heads')
      .then(r => r.json())
      .then(setAccountHeads)
      .catch(() => {})
  }, [])

  const sales = useMemo(() => {
    const list = data.sales || []
    if (!search) return list
    const q = search.toLowerCase()
    return list.filter(s => s.clientName?.toLowerCase().includes(q) || s.number?.includes(q))
  }, [data.sales, search])

  // Summary stats
  const totalRevenue = useMemo(() => sales.filter(s => s.status === 'confirmed').reduce((sum, s) => sum + (s.total || 0), 0), [sales])
  const totalProfit  = useMemo(() => sales.filter(s => s.status === 'confirmed').reduce((sum, s) => sum + (s.totalProfit || 0), 0), [sales])
  const avgMargin    = totalRevenue > 0 ? +((totalProfit / totalRevenue) * 100).toFixed(1) : 0

  const handleSave = async (form) => {
    try {
      const url    = selected ? `/api/sales/${selected.id}` : '/api/sales'
      const method = selected ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error || 'Save failed'); return }
      toast.success(selected ? 'Sale updated!' : `${result.number} confirmed! Stock deducted. Customer ledger updated.`)
      await refreshData()
      setView('list')
      setSelected(null)
    } catch (err) {
      toast.error('Network error — check server')
    }
  }

  if (view !== 'list') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>🛍️ <span>{selected ? 'Edit Sale' : 'New Sale'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <SaleForm
          initial={selected}
          onSave={handleSave}
          onCancel={() => { setView('list'); setSelected(null) }}
        />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🛍️ <span>Sales</span></h2>
        <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ New Sale</button>
      </div>

      {/* Summary cards */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="stat-card card-blue">
          <div className="label">🛍️ Total Sales</div>
          <div className="value" style={{ fontSize: 22 }}>{sales.filter(s => s.status === 'confirmed').length}</div>
        </div>
        <div className="stat-card card-green">
          <div className="label">💰 Revenue</div>
          <div className="value" style={{ fontSize: 16 }}>PKR {totalRevenue.toLocaleString()}</div>
        </div>
        <div className="stat-card card-purple">
          <div className="label">📈 Gross Profit</div>
          <div className="value" style={{ fontSize: 16 }}>PKR {totalProfit.toLocaleString()}</div>
        </div>
        <div className="stat-card card-amber">
          <div className="label">📊 Avg Margin</div>
          <div className="value" style={{ fontSize: 22 }}>{avgMargin}%</div>
        </div>
      </div>

      {/* AR summary from account heads */}
      {accountHeads && accountHeads.accountsReceivable > 0 && (
        <div style={{ marginBottom: 14, padding: '10px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: 13 }}>
          📥 <strong>Accounts Receivable:</strong> PKR {Number(accountHeads.accountsReceivable).toLocaleString()} outstanding from clients
        </div>
      )}

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 300 }} placeholder="🔍 Search by client or #..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Client</th><th>Date</th><th>Items</th>
              <th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th>
              <th>Payment</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No sales yet. Create your first sale.</td></tr>
            )}
            {sales.map(s => {
              const margin = s.total > 0 ? +((s.totalProfit / s.total) * 100).toFixed(0) : 0
              const balance = (s.total || 0) - (s.paidAmount || 0)
              return (
                <tr key={s.id}>
                  <td className="font-mono" style={{ fontSize: 12 }}>{s.number}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.clientName}</div>
                    {s.clientContact && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.clientContact}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{s.date}</td>
                  <td>{(s.items || []).length}</td>
                  <td style={{ fontWeight: 700 }}>PKR {Number(s.total || 0).toLocaleString()}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>PKR {Number(s.totalCost || 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 700, color: (s.totalProfit || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    PKR {Number(s.totalProfit || 0).toLocaleString()}
                  </td>
                  <td>
                    <span style={{ fontWeight: 800, fontSize: 13, color: margin >= 30 ? 'var(--green)' : margin >= 15 ? 'var(--amber)' : 'var(--red)' }}>
                      {margin}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${s.paymentStatus === 'paid' ? 'approved' : s.paymentStatus === 'partial' ? 'pending' : 'draft'}`}>
                      {s.paymentStatus}
                    </span>
                    {balance > 0 && <div style={{ fontSize: 11, color: 'var(--red)' }}>Bal: PKR {Number(balance).toLocaleString()}</div>}
                  </td>
                  <td>
                    <span className={`badge badge-${s.status === 'confirmed' ? 'approved' : s.status === 'returned' ? 'cancelled' : 'draft'}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setMasterAction({ type: 'edit', item: s })} title="Edit">✏️</button>
                      <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: s.id })} title="Delete">🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {sales.length > 0 && (
            <tfoot>
              <tr style={{ background: 'rgba(255,255,255,0.04)', fontWeight: 700 }}>
                <td colSpan={4} style={{ textAlign: 'right', padding: '10px 12px', fontSize: 13 }}>Totals:</td>
                <td style={{ padding: '10px 12px', color: 'var(--blue)' }}>PKR {totalRevenue.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>PKR {sales.reduce((s, x) => s + (x.totalCost || 0), 0).toLocaleString()}</td>
                <td style={{ padding: '10px 12px', color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>PKR {totalProfit.toLocaleString()}</td>
                <td style={{ padding: '10px 12px' }}>{avgMargin}%</td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'delete' ? 'Confirm Delete' : 'Confirm Edit'}
          onSuccess={() => {
            if (masterAction.type === 'delete') {
              deleteRecord('sales', masterAction.id)
              toast.success('Sale deleted.')
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
