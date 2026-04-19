import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import MasterCodeModal from '../common/MasterCodeModal'
import ContactSelect from '../common/ContactSelect'
import { exportDayBookExcel } from '../../utils/excelExport'
import { exportDayBookPDF } from '../../utils/pdfExport'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'

const WALLETS = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa']
const WALLET_ICONS = { Cash: '💵', Bank: '🏦', JazzCash: '📱', EasyPaisa: '🟢' }

function WalletManager() {
  const { data, updateNested } = useApp()
  const [editing, setEditing] = useState(null)
  const [amount, setAmount] = useState('')
  const [masterAction, setMasterAction] = useState(null)

  const walletKeys = { Cash: 'cash', Bank: 'bank', JazzCash: 'jazzcash', EasyPaisa: 'easypaisa' }

  return (
    <div className="section-box">
      <div className="section-title">👛 Wallets & Cash Balances</div>
      <div className="wallet-cards">
        {WALLETS.map(w => {
          const key = walletKeys[w]
          const bal = data.wallets?.[key] || 0
          return (
            <div key={w} className="wallet-card glass" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 16 }}>
              <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{WALLET_ICONS[w]}</span>
                <button className="btn btn-secondary btn-xs" onClick={() => setMasterAction({ wallet: w, key })}>Edit</button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>{w}</div>
              <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                PKR {Number(bal).toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>

      {masterAction && (
        <MasterCodeModal
          title={`Update ${masterAction.wallet} Balance`}
          onSuccess={() => {
            setEditing(masterAction)
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-title">{WALLET_ICONS[editing.wallet]} Update {editing.wallet}</div>
            <div className="input-group" style={{ marginBottom: 16 }}>
              <label className="input-label">New Balance (PKR)</label>
              <input type="number" className="input" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Enter amount" autoFocus />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary w-full" onClick={() => { setEditing(null); setAmount('') }}>Cancel</button>
              <button className="btn btn-primary w-full" onClick={() => {
                updateNested('wallets', editing.key, parseFloat(amount) || 0)
                toast.success(`${editing.wallet} updated!`)
                setEditing(null); setAmount('')
              }}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CATEGORIES = {
  income:            ['Client Payment', 'Sales Recovery', 'Advance Received', 'Refund', 'Other Income'],
  expense:           ['Salary', 'Rent', 'Utilities', 'Transport', 'Stock Purchase', 'Repair', 'Miscellaneous'],
  'advance-given':   ['To Supplier', 'To Employee', 'To Other'],
  'advance-received':['From Client', 'From Other'],
  transfer:          ['Cash to Bank', 'Bank to Cash', 'Internal Transfer'],
}

function EditEntryModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState({ ...entry })
  const [saving, setSaving] = useState(false)
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.description) { toast.error('Description required.'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/dayBook/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, debit: parseFloat(form.debit) || 0, credit: parseFloat(form.credit) || 0 }),
      })
      const saved = await res.json()
      if (!res.ok) { toast.error(saved.error || 'Failed'); setSaving(false); return }
      toast.success('Entry updated!')
      onSave()
    } catch { toast.error('Connection error.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">✏️ Edit Day Book Entry</div>
        <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={form.type} onChange={e => { setField('type', e.target.value); setField('category', '') }}>
              {['income', 'expense', 'advance-given', 'advance-received', 'transfer'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Category</label>
            <select className="input" value={form.category || ''} onChange={e => setField('category', e.target.value)}>
              <option value="">— Select —</option>
              {(CATEGORIES[form.type] || []).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Wallet</label>
            <select className="input" value={form.wallet} onChange={e => setField('wallet', e.target.value)}>
              {WALLETS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Description *</label>
            <input className="input" value={form.description} onChange={e => setField('description', e.target.value)} spellCheck />
          </div>
          <div className="input-group">
            <label className="input-label">Party</label>
            <input className="input" value={form.partyName || ''} onChange={e => setField('partyName', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Reference</label>
            <input className="input" value={form.reference || ''} onChange={e => setField('reference', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Debit (Dr)</label>
            <input type="number" className="input" min="0" value={form.debit || ''} onChange={e => setField('debit', e.target.value)}
              style={{ borderColor: form.debit ? 'var(--red)' : undefined }} />
          </div>
          <div className="input-group">
            <label className="input-label">Credit (Cr)</label>
            <input type="number" className="input" min="0" value={form.credit || ''} onChange={e => setField('credit', e.target.value)}
              style={{ borderColor: form.credit ? 'var(--green)' : undefined }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💾 Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DayBook() {
  const { data, refreshData } = useApp()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income', description: '', debit: '', credit: '',
    wallet: 'Cash', reference: '', category: '',
    partyName: '', accountHeadID: '',
  })
  const [masterAction, setMasterAction] = useState(null)
  const [editEntry, setEditEntry] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [softDeleted, setSoftDeleted] = useState(new Set())

  const entries = useMemo(() => {
    let list = [...(data.dayBook || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (search) list = list.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()) || e.reference?.includes(search))
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    list = list.filter(e => !softDeleted.has(e.id))
    return list
  }, [data.dayBook, search, typeFilter, softDeleted])

  const totals = useMemo(() => entries.reduce((acc, e) => ({ debit: acc.debit + (parseFloat(e.debit) || 0), credit: acc.credit + (parseFloat(e.credit) || 0) }), { debit: 0, credit: 0 }), [entries])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.description) { toast.error('Description required.'); return }
    if (!form.debit && !form.credit) { toast.error('Enter debit or credit amount.'); return }
    const entry = { ...form, debit: parseFloat(form.debit) || 0, credit: parseFloat(form.credit) || 0 }
    try {
      const res = await fetch('/api/dayBook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, id: Date.now().toString(), createdAt: new Date().toISOString() }),
      })
      const saved = await res.json()
      if (!res.ok) { toast.error(saved.error || 'Failed to save entry'); return }
      await refreshData()
      setForm(f => ({ ...f, description: '', debit: '', credit: '', reference: '', category: '', partyName: '', accountHeadID: '' }))
      toast.success('Entry added & ledger updated!')
    } catch {
      toast.error('Connection error.')
    }
  }

  const handleDelete = (id) => {
    setMasterAction(null)
    // Soft-delete: hide immediately in UI
    setSoftDeleted(prev => new Set([...prev, id]))

    let undone = false

    // Show undo toast for 5 seconds
    toast(
      (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>Entry removed</span>
          <button
            onClick={() => {
              undone = true
              setSoftDeleted(prev => { const n = new Set(prev); n.delete(id); return n })
              toast.dismiss(t.id)
              toast.success('Deletion undone!')
            }}
            style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', color: '#4ade80', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
          >↩ Undo</button>
        </div>
      ),
      { duration: 5000, id: `del-${id}` }
    )

    // After 5s, if not undone — permanently delete + reverse ledger on server
    setTimeout(async () => {
      if (undone) return
      try {
        await fetch(`/api/dayBook/${id}`, { method: 'DELETE' })
        setSoftDeleted(prev => { const n = new Set(prev); n.delete(id); return n })
        await refreshData()  // ledger auto-updated by server
      } catch {
        // Restore on failure
        setSoftDeleted(prev => { const n = new Set(prev); n.delete(id); return n })
        toast.error('Delete failed — entry restored.')
      }
    }, 5000)
  }

  return (
    <div className="section-box">
      <div className="section-title" style={{ justifyContent: 'space-between' }}>
        <span>📒 Day Book</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => exportDayBookPDF(entries)}>🖨️ PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={() => exportDayBookExcel(data.dayBook || [])}>📊 Excel</button>
        </div>
      </div>

      {/* Add Entry */}
      <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', marginBottom: 16 }}>
        <div className="form-grid form-grid-3" style={{ marginBottom: 10 }}>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={form.type} onChange={e => { setField('type', e.target.value); setField('category', '') }}>
              {['income', 'expense', 'advance-given', 'advance-received', 'transfer'].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Category</label>
            <select className="input" value={form.category} onChange={e => setField('category', e.target.value)}>
              <option value="">— Select —</option>
              {(CATEGORIES[form.type] || []).map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Wallet</label>
            <select className="input" value={form.wallet} onChange={e => setField('wallet', e.target.value)}>
              {WALLETS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Description *</label>
            <input className="input" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Payment received from / paid to..." spellCheck />
          </div>
          <div className="input-group">
            <label className="input-label">Party / Account</label>
            <ContactSelect
              value={form.partyName}
              onChange={(name, contact) => {
                setField('partyName', name)
                if (contact) setField('accountHeadID', contact.accountHeadID || '')
                else setField('accountHeadID', '')
              }}
              placeholder="Search contact (optional)..."
            />
            {form.accountHeadID && (
              <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 3, fontFamily: 'monospace' }}>
                {form.accountHeadID}
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Reference</label>
            <input className="input" value={form.reference} onChange={e => setField('reference', e.target.value)} placeholder="INV-201, SO-..." />
          </div>
          <div className="input-group">
            <label className="input-label">Debit (PKR)</label>
            <input type="number" className="input" min="0" value={form.debit} onChange={e => setField('debit', e.target.value)} placeholder="0.00" style={{ borderColor: form.debit ? 'var(--red)' : undefined }} />
          </div>
          <div className="input-group">
            <label className="input-label">Credit (PKR)</label>
            <input type="number" className="input" min="0" value={form.credit} onChange={e => setField('credit', e.target.value)} placeholder="0.00" style={{ borderColor: form.credit ? 'var(--green)' : undefined }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary w-full" onClick={handleAdd}>+ Add Entry</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>TOTAL DEBIT</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif' }}>PKR {totals.debit.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>TOTAL CREDIT</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif' }}>PKR {totals.credit.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>NET BALANCE</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: totals.credit - totals.debit >= 0 ? 'var(--green)' : 'var(--red)' }}>PKR {(totals.credit - totals.debit).toLocaleString()}</div>
        </div>
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 260 }} placeholder="🔍 Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {['income', 'expense', 'advance-given', 'advance-received', 'transfer'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Party</th><th>Ref</th><th>Wallet</th><th className="text-red">Debit (Dr)</th><th className="text-green">Credit (Cr)</th><th></th></tr>
          </thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No entries yet.</td></tr>}
            {entries.map(e => (
              <tr key={e.id}>
                <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.date}</td>
                <td>
                  <span className="badge badge-draft" style={{
                    fontSize: 10, textTransform: 'capitalize',
                    background: e.type === 'income' ? 'rgba(34,197,94,0.15)' : e.type === 'expense' ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)',
                    color: e.type === 'income' ? 'var(--green)' : e.type === 'expense' ? 'var(--red)' : 'var(--blue)',
                  }}>{e.type}</span>
                </td>
                <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.category || '—'}</td>
                <td style={{ fontWeight: 500 }}>{e.description}</td>
                <td style={{ fontSize: 12 }}>
                  {e.partyName ? (
                    <div>
                      <div style={{ fontWeight: 600 }}>{e.partyName}</div>
                      {e.accountHeadID && <div style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'monospace' }}>{e.accountHeadID}</div>}
                    </div>
                  ) : '—'}
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.reference || '—'}</td>
                <td style={{ fontSize: 12 }}>{e.wallet}</td>
                <td className="text-red bold">{e.debit ? `PKR ${Number(e.debit).toLocaleString()}` : '—'}</td>
                <td className="text-green bold">{e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => setEditEntry(e)}>✏️</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ id: e.id })}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal title="Confirm Delete Entry" onSuccess={() => handleDelete(masterAction.id)} onCancel={() => setMasterAction(null)} />
      )}
      {editEntry && (
        <EditEntryModal
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSave={async () => { setEditEntry(null); await refreshData() }}
        />
      )}
    </div>
  )
}

function Advances() {
  const { data, addRecord, deleteRecord } = useApp()
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), from: '', to: '', type: 'client-to-admin', amount: '', description: '', status: 'pending' })
  const [masterAction, setMasterAction] = useState(null)
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const advances = data.advances || []
  const total = advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  const recovered = advances.filter(a => a.status === 'recovered').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)

  return (
    <div className="section-box">
      <div className="section-title">💳 Advance Tracking</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {[['Total Given', total, 'var(--amber)'], ['Recovered', recovered, 'var(--green)'], ['Outstanding', total - recovered, 'var(--red)']].map(([l, v, c]) => (
          <div key={l} style={{ flex: 1, minWidth: 140, padding: '12px 16px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: c, fontWeight: 700, textTransform: 'uppercase' }}>{l}</div>
            <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: c }}>PKR {Number(v).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Add Form */}
      <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', marginBottom: 14 }}>
        <div className="form-grid">
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Type</label>
            <select className="input" value={form.type} onChange={e => setField('type', e.target.value)}>
              <option value="client-to-admin">Client → Admin</option>
              <option value="admin-to-supplier">Admin → Supplier</option>
              <option value="admin-to-employee">Admin → Employee</option>
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">From</label>
            <input className="input" value={form.from} onChange={e => setField('from', e.target.value)} placeholder="Payer name" />
          </div>
          <div className="input-group">
            <label className="input-label">To</label>
            <input className="input" value={form.to} onChange={e => setField('to', e.target.value)} placeholder="Receiver name" />
          </div>
          <div className="input-group">
            <label className="input-label">Amount (PKR)</label>
            <input type="number" className="input" min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Status</label>
            <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="recovered">Recovered</option>
            </select>
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Description</label>
            <input className="input" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Advance for order..." spellCheck />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary w-full" onClick={() => {
              if (!form.amount || !form.from) { toast.error('Fill required fields.'); return }
              addRecord('advances', form)
              setForm(f => ({ ...f, from: '', to: '', amount: '', description: '' }))
              toast.success('Advance recorded!')
            }}>+ Record</button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Description</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {advances.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No advances recorded.</td></tr>}
            {[...advances].sort((a, b) => new Date(b.date) - new Date(a.date)).map(adv => (
              <tr key={adv.id}>
                <td style={{ fontSize: 12 }}>{adv.date}</td>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{adv.type}</td>
                <td>{adv.from}</td>
                <td>{adv.to || '—'}</td>
                <td className="bold" style={{ color: 'var(--amber)' }}>PKR {Number(adv.amount).toLocaleString()}</td>
                <td style={{ fontSize: 12 }}>{adv.description}</td>
                <td><span className={`badge badge-${adv.status === 'recovered' ? 'paid' : 'pending'}`}>{adv.status}</span></td>
                <td><button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ id: adv.id })}>🗑️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal title="Confirm Delete" onSuccess={() => { deleteRecord('advances', masterAction.id); setMasterAction(null); toast.success('Deleted.') }} onCancel={() => setMasterAction(null)} />
      )}
    </div>
  )
}

export default function Finance() {
  const [tab, setTab] = useState('daybook')

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>💰 <span>Finance & Accounts</span></h2>
      </div>

      <WalletManager />

      <div className="tabs">
        {[['daybook', '📒 Day Book'], ['advances', '💳 Advances']].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'daybook' && <DayBook />}
      {tab === 'advances' && <Advances />}
    </div>
  )
}
