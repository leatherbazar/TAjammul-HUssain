import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import AttributeMatrix, { calcMatrixTotal } from '../common/AttributeMatrix'
import MasterCodeModal from '../common/MasterCodeModal'
import { exportInventoryExcel } from '../../utils/excelExport'
import toast from 'react-hot-toast'

function ItemForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    name: '', category: '', sku: '', description: '',
    costPrice: 0, sellPrice: 0,
    useMatrix: false, matrixRows: [],
    color: '', qty: 0, unit: 'pcs',
    minStock: 0, supplier: '',
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const totalQty = form.useMatrix ? calcMatrixTotal(form.matrixRows) : (parseInt(form.qty) || 0)
  const margin = form.sellPrice > 0 ? (((form.sellPrice - form.costPrice) / form.sellPrice) * 100).toFixed(1) : 0

  return (
    <div>
      <div className="section-box">
        <div className="section-title">📦 Item Details</div>
        <div className="form-grid form-grid-3">
          <div className="input-group col-span-2">
            <label className="input-label">Item Name *</label>
            <input className="input" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="e.g. Men's Winter Jacket" spellCheck />
          </div>
          <div className="input-group">
            <label className="input-label">SKU</label>
            <input className="input" value={form.sku} onChange={e => setField('sku', e.target.value)} placeholder="Auto or manual" />
          </div>
          <div className="input-group">
            <label className="input-label">Category</label>
            <input className="input" value={form.category} onChange={e => setField('category', e.target.value)} list="cat-list" placeholder="Jacket, Shirt..." />
            <datalist id="cat-list">
              {['Jacket', 'Shirt', 'Trouser', 'Suit', 'Accessories', 'Fabric'].map(c => <option key={c}>{c}</option>)}
            </datalist>
          </div>
          <div className="input-group">
            <label className="input-label">Supplier</label>
            <input className="input" value={form.supplier} onChange={e => setField('supplier', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Unit</label>
            <input
              className="input"
              list="unit-list"
              value={form.unit}
              onChange={e => setField('unit', e.target.value)}
              placeholder="pcs, sqt, meters..."
            />
            <datalist id="unit-list">
              {['pcs', 'sqt', 'meters', 'kg', 'pairs', 'sets', 'dozen', 'yards', 'rolls', 'boxes'].map(u => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </div>
          <div className="input-group">
            <label className="input-label">Cost Price (PKR)</label>
            <input type="number" className="input" min="0" value={form.costPrice} onChange={e => setField('costPrice', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Sell Price (PKR)</label>
            <input type="number" className="input" min="0" value={form.sellPrice} onChange={e => setField('sellPrice', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Margin</label>
            <div style={{ padding: '9px 12px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--glass-border)', color: margin > 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {margin}%
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Min Stock Alert</label>
            <input type="number" className="input" min="0" value={form.minStock} onChange={e => setField('minStock', e.target.value)} />
          </div>
          <div className="input-group col-span-3">
            <label className="input-label">Description</label>
            <textarea className="input" value={form.description} onChange={e => setField('description', e.target.value)} rows={2} spellCheck />
          </div>
        </div>
      </div>

      <div className="section-box">
        <div className="section-title" style={{ justifyContent: 'space-between' }}>
          <span>📏 Stock Breakdown</span>
          <button
            className={`btn btn-sm ${form.useMatrix ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setField('useMatrix', !form.useMatrix)}
          >🎨 {form.useMatrix ? 'Simple Mode' : 'Size/Color Matrix'}</button>
        </div>

        {form.useMatrix ? (
          <AttributeMatrix rows={form.matrixRows} onChange={rows => setField('matrixRows', rows)} />
        ) : (
          <div className="form-grid form-grid-2">
            <div className="input-group">
              <label className="input-label">Color</label>
              <input className="input" value={form.color} onChange={e => setField('color', e.target.value)} placeholder="e.g. Black" />
            </div>
            <div className="input-group">
              <label className="input-label">Quantity</label>
              <input type="number" className="input" min="0" value={form.qty} onChange={e => setField('qty', e.target.value)} />
            </div>
          </div>
        )}

        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13 }}>Total Stock:</span>
          <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: totalQty < (form.minStock || 0) ? 'var(--red)' : 'var(--green)' }}>{totalQty} {form.unit}</span>
          {totalQty < (form.minStock || 0) && <span style={{ fontSize: 12, color: 'var(--red)' }}>⚠️ Below minimum!</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" onClick={() => {
          if (!form.name) { toast.error('Item name required.'); return }
          onSave({ ...form, qty: totalQty, sku: form.sku || `SKU-${Date.now().toString().slice(-6)}` })
        }}>💾 Save Item</button>
      </div>
    </div>
  )
}

export default function Inventory({ isEmployee = false }) {
  const { data, addRecord, updateRecord, deleteRecord } = useApp()
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [masterAction, setMasterAction] = useState(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  const items = useMemo(() => {
    let list = data.inventory || []
    if (search) list = list.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.sku?.includes(search))
    if (category !== 'all') list = list.filter(i => i.category === category)
    return list
  }, [data.inventory, search, category])

  const categories = useMemo(() => {
    const cats = [...new Set((data.inventory || []).map(i => i.category).filter(Boolean))]
    return cats
  }, [data.inventory])

  const handleSave = (f) => {
    if (selected) { updateRecord('inventory', selected.id, f); toast.success('Item updated!') }
    else { addRecord('inventory', f); toast.success('Item added to inventory!') }
    setView('list'); setSelected(null)
  }

  const totalValue = useMemo(() => (data.inventory || []).reduce((s, i) => s + (i.qty || 0) * (i.costPrice || 0), 0), [data.inventory])
  const lowStock = useMemo(() => (data.inventory || []).filter(i => i.qty <= (i.minStock || 0)), [data.inventory])

  if (view !== 'list') {
    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>📦 <span>{selected ? 'Edit Item' : 'Add Item'}</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => { setView('list'); setSelected(null) }}>← Back</button>
        </div>
        <ItemForm initial={selected} onSave={handleSave} onCancel={() => { setView('list'); setSelected(null) }} />
      </div>
    )
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📦 <span>Inventory</span></h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportInventoryExcel(data.inventory || [])}>📊 Export Excel</button>
          <button className="btn btn-primary" onClick={() => { setSelected(null); setView('new') }}>+ Add Item</button>
        </div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="stat-card card-blue"><div className="label">Total Items</div><div className="value" style={{ fontSize: 22 }}>{(data.inventory || []).length}</div></div>
        <div className="stat-card card-green"><div className="label">Stock Value</div><div className="value" style={{ fontSize: 16 }}>PKR {totalValue.toLocaleString()}</div></div>
        <div className="stat-card card-red"><div className="label">Low Stock</div><div className="value" style={{ fontSize: 22 }}>{lowStock.length}</div></div>
        <div className="stat-card card-purple"><div className="label">Categories</div><div className="value" style={{ fontSize: 22 }}>{categories.length}</div></div>
      </div>

      {lowStock.length > 0 && (
        <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', marginBottom: 16, fontSize: 13 }}>
          ⚠️ <strong>Low Stock Alert:</strong> {lowStock.map(i => i.name).join(', ')}
        </div>
      )}

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 280 }} placeholder="🔍 Search by name or SKU..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={category} onChange={e => setCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {categories.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>SKU</th><th>Item</th><th>Category</th><th>Color</th><th>Stock</th><th>Min</th><th>Cost</th><th>Sell</th><th>Margin</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No items. Add your first inventory item.</td></tr>}
            {items.map(item => {
              const margin = item.sellPrice > 0 ? (((item.sellPrice - item.costPrice) / item.sellPrice) * 100).toFixed(0) : 0
              const isLow = item.qty <= (item.minStock || 0)
              return (
                <tr key={item.id}>
                  <td className="font-mono" style={{ fontSize: 11 }}>{item.sku}</td>
                  <td><div style={{ fontWeight: 600 }}>{item.name}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description?.slice(0, 40)}</div></td>
                  <td><span className="badge badge-draft">{item.category || '—'}</span></td>
                  <td style={{ fontSize: 12 }}>{item.color || (item.useMatrix ? `${(item.matrixRows || []).length} colors` : '—')}</td>
                  <td>
                    <span style={{ fontWeight: 800, color: isLow ? 'var(--red)' : 'var(--green)', fontFamily: 'Orbitron, sans-serif', fontSize: 14 }}>{item.qty}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>{item.unit}</span>
                    {isLow && <span style={{ marginLeft: 4, fontSize: 11 }}>⚠️</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{item.minStock || 0}</td>
                  <td style={{ fontSize: 12 }}>PKR {Number(item.costPrice || 0).toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>PKR {Number(item.sellPrice || 0).toLocaleString()}</td>
                  <td><span style={{ color: margin > 20 ? 'var(--green)' : margin > 10 ? 'var(--amber)' : 'var(--red)', fontWeight: 700, fontSize: 12 }}>{margin}%</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setMasterAction({ type: 'edit', item })}>✏️</button>
                      {!isEmployee && <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'delete', id: item.id })}>🗑️</button>}
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
          onSuccess={() => {
            if (masterAction.type === 'delete') { deleteRecord('inventory', masterAction.id); toast.success('Deleted.') }
            else { setSelected(masterAction.item); setView('edit') }
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
