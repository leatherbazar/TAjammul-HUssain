import React, { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { fmtDate } from '../../utils/fmt'
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

  // Wallet balance = opening + type-based direction from Day Book entries
  // income/advance-received = +IN, expense/advance-given = −OUT
  // transfer: wallet=FROM (−), toWallet=TO (+)
  const walletBalances = useMemo(() => {
    const IN_TYPES  = new Set(['income', 'advance-received'])
    const OUT_TYPES = new Set(['expense', 'advance-given'])
    const result = {}
    const allEntries = data.dayBook || []
    for (const [w, key] of Object.entries(walletKeys)) {
      const opening = data.wallets?.[key] || 0
      const wLower = w.toLowerCase().trim()
      let balance = opening
      for (const e of allEntries) {
        const amount = (parseFloat(e.debit) || 0) + (parseFloat(e.credit) || 0) + (parseFloat(e.amount) || 0)
        const t = (e.type || '').toLowerCase()
        const fromW = typeof e.wallet   === 'string' ? e.wallet.toLowerCase().trim()   : ''
        const toW   = typeof e.toWallet === 'string' ? e.toWallet.toLowerCase().trim() : ''
        if (t === 'transfer') {
          if (fromW === wLower) balance -= amount   // money leaves FROM wallet
          if (toW   === wLower) balance += amount   // money arrives in TO wallet
        } else if (fromW === wLower) {
          if (IN_TYPES.has(t))  balance += amount
          else if (OUT_TYPES.has(t)) balance -= amount
        }
      }
      result[key] = balance
    }
    return result
  }, [data.wallets, data.dayBook])

  return (
    <div className="section-box">
      <div className="section-title">👛 Wallets & Cash Balances</div>
      <div className="wallet-cards">
        {WALLETS.map(w => {
          const key = walletKeys[w]
          const bal = walletBalances[key] || 0
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
  const { data, refreshData, currentCompany } = useApp()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income', description: '', debit: '', credit: '', amount: '',
    wallet: 'Cash', toWallet: 'Bank', reference: '', category: '',
    partyName: '', accountHeadID: '',
  })
  const [addingSaving, setAddingSaving] = useState(false)
  const [masterAction, setMasterAction] = useState(null)
  const [editEntry, setEditEntry] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [softDeleted, setSoftDeleted] = useState(new Set())
  // Default month filter = current YYYY-MM
  const [monthFilter, setMonthFilter] = useState(() => new Date().toISOString().slice(0, 7))
  // Ref map of id → undone flag — avoids stale closure issues with rapid deletes
  const undoneMap = React.useRef({})

  // Build list of months that have entries (for the dropdown)
  const availableMonths = useMemo(() => {
    const seen = new Set()
    for (const e of (data.dayBook || [])) {
      const m = (e.date || '').slice(0, 7)
      if (m) seen.add(m)
    }
    return [...seen].sort((a, b) => b.localeCompare(a))
  }, [data.dayBook])

  const entries = useMemo(() => {
    let list = [...(data.dayBook || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (monthFilter !== 'all') list = list.filter(e => (e.date || '').slice(0, 7) === monthFilter)
    if (search) list = list.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()) || e.reference?.includes(search))
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    list = list.filter(e => !softDeleted.has(e.id))
    return list
  }, [data.dayBook, search, typeFilter, softDeleted, monthFilter])

  // Totals based on type (reliable for both auto and manual entries)
  const totals = useMemo(() => {
    const IN_TYPES  = new Set(['income', 'advance-received'])
    const OUT_TYPES = new Set(['expense', 'advance-given'])
    return entries.reduce((acc, e) => {
      const amt = (parseFloat(e.debit) || 0) + (parseFloat(e.credit) || 0) + (parseFloat(e.amount) || 0)
      const t = (e.type || '').toLowerCase()
      if (IN_TYPES.has(t))   return { ...acc, debit:  acc.debit  + amt }
      if (OUT_TYPES.has(t))  return { ...acc, credit: acc.credit + amt }
      return acc
    }, { debit: 0, credit: 0 })
  }, [entries])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.description) { toast.error('Description required.'); return }
    const isTransfer = form.type === 'transfer'
    const transferAmt = parseFloat(form.amount) || 0
    if (isTransfer && !transferAmt) { toast.error('Enter transfer amount.'); return }
    if (isTransfer && form.wallet === form.toWallet) { toast.error('From and To wallets must be different.'); return }
    if (!isTransfer && !form.debit && !form.credit) { toast.error('Enter debit or credit amount.'); return }
    if (addingSaving) return
    setAddingSaving(true)
    try {
      if (isTransfer) {
        const base = { date: form.date, type: 'transfer', description: form.description, reference: form.reference, amount: transferAmt, debit: transferAmt, credit: 0 }
        const now = Date.now()
        await fetch('/api/dayBook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, id: now.toString(), wallet: form.wallet, toWallet: form.toWallet, category: `Transfer to ${form.toWallet}`, createdAt: new Date().toISOString() }) })
        await fetch('/api/dayBook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...base, id: (now + 1).toString(), wallet: form.toWallet, toWallet: form.wallet, category: `Transfer from ${form.wallet}`, createdAt: new Date().toISOString() }) })
        await refreshData()
        toast.success(`Transfer: ${form.wallet} → ${form.toWallet} PKR ${transferAmt.toLocaleString()}`)
      } else {
        const entry = { ...form, debit: parseFloat(form.debit) || 0, credit: parseFloat(form.credit) || 0 }
        const res = await fetch('/api/dayBook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...entry, id: Date.now().toString(), createdAt: new Date().toISOString() }) })
        const saved = await res.json()
        if (!res.ok) { toast.error(saved.error || 'Failed to save entry'); return }
        await refreshData()
        toast.success('Entry added & ledger updated!')
      }
      setForm(f => ({ ...f, description: '', debit: '', credit: '', amount: '', reference: '', category: '', partyName: '', accountHeadID: '' }))
    } catch {
      toast.error('Connection error.')
    } finally {
      setAddingSaving(false)
    }
  }

  const handleDelete = (id) => {
    setMasterAction(null)
    setSoftDeleted(prev => new Set([...prev, id]))
    undoneMap.current[id] = false

    toast(
      (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>Entry removed</span>
          <button
            onClick={() => {
              undoneMap.current[id] = true
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

    setTimeout(async () => {
      if (undoneMap.current[id]) { delete undoneMap.current[id]; return }
      delete undoneMap.current[id]
      try {
        await fetch(`/api/dayBook/${id}`, { method: 'DELETE' })
        setSoftDeleted(prev => { const n = new Set(prev); n.delete(id); return n })
        await refreshData()
      } catch {
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
          <button className="btn btn-secondary btn-sm" onClick={() => exportDayBookPDF(entries, null, currentCompany)}>🖨️ PDF</button>
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
            <label className="input-label">{form.type === 'transfer' ? 'From Wallet' : 'Wallet'}</label>
            <select className="input" value={form.wallet} onChange={e => setField('wallet', e.target.value)}>
              {WALLETS.map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          {form.type === 'transfer' && (
            <div className="input-group">
              <label className="input-label">To Wallet</label>
              <select className="input" value={form.toWallet} onChange={e => setField('toWallet', e.target.value)}>
                {WALLETS.filter(w => w !== form.wallet).map(w => <option key={w}>{w}</option>)}
              </select>
            </div>
          )}
          <div className={form.type === 'transfer' ? 'input-group' : 'input-group col-span-2'}>
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
              <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'monospace', color: 'var(--blue)', fontWeight: 700 }}>{form.accountHeadID}</span>
                <span style={{ padding: '2px 7px', borderRadius: 5, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: 'var(--green)', fontWeight: 700, fontSize: 10, letterSpacing: 0.3 }}>
                  ✅ Ledger auto-updates
                </span>
              </div>
            )}
          </div>
          <div className="input-group">
            <label className="input-label">Reference</label>
            <input className="input" value={form.reference} onChange={e => setField('reference', e.target.value)} placeholder="INV-201, SO-..." />
          </div>
          {form.type === 'transfer' ? (
            <div className="input-group">
              <label className="input-label">Amount (PKR)</label>
              <input type="number" className="input" min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" style={{ borderColor: form.amount ? 'var(--blue)' : undefined }} />
            </div>
          ) : (
            <>
              <div className="input-group">
                <label className="input-label">Debit — Money IN (PKR)</label>
                <input type="number" className="input" min="0" value={form.debit} onChange={e => { setField('debit', e.target.value); if (e.target.value) setField('credit', '') }} placeholder="0.00" style={{ borderColor: form.debit ? 'var(--green)' : undefined }} />
              </div>
              <div className="input-group">
                <label className="input-label">Credit — Money OUT (PKR)</label>
                <input type="number" className="input" min="0" value={form.credit} onChange={e => { setField('credit', e.target.value); if (e.target.value) setField('debit', '') }} placeholder="0.00" style={{ borderColor: form.credit ? 'var(--red)' : undefined }} />
              </div>
            </>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary w-full" onClick={handleAdd} disabled={addingSaving} style={addingSaving ? { opacity: 0.6, cursor: 'not-allowed' } : {}}>{addingSaving ? '⏳ Saving…' : '+ Add Entry'}</button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>TOTAL INCOME (IN)</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: 'var(--green)' }}>PKR {totals.debit.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>TOTAL EXPENSE (OUT)</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: 'var(--red)' }}>PKR {totals.credit.toLocaleString()}</div>
        </div>
        <div style={{ flex: 1, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>NET BALANCE</div>
          <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Orbitron, sans-serif', color: totals.debit - totals.credit >= 0 ? 'var(--green)' : 'var(--red)' }}>PKR {Number(totals.debit - totals.credit).toLocaleString()}</div>
        </div>
      </div>

      <div className="search-bar">
        <input className="input" style={{ maxWidth: 220 }} placeholder="🔍 Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="input" style={{ maxWidth: 150 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="all">All Months</option>
          {availableMonths.map(m => {
            const [y, mo] = m.split('-')
            const label = new Date(+y, +mo - 1).toLocaleString('default', { month: 'long', year: 'numeric' })
            return <option key={m} value={m}>{label}</option>
          })}
        </select>
        <select className="input" style={{ maxWidth: 140 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          {['income', 'expense', 'advance-given', 'advance-received', 'transfer'].map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Party</th><th>Ref</th><th>Wallet</th><th className="text-green">Money IN</th><th className="text-red">Money OUT</th><th></th></tr>
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
                <td style={{ fontSize: 12 }}>
                  {e.wallet}
                  {e.type === 'transfer' && e.toWallet && (
                    <span style={{ fontSize: 10, color: 'var(--blue)', marginLeft: 4 }}>→ {e.toWallet}</span>
                  )}
                </td>
                <td className="text-green bold">{(e.debit || e.amount) ? `PKR ${Number(e.debit || e.amount || 0).toLocaleString()}` : '—'}</td>
                <td className="text-red bold">{e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-xs" onClick={() => setEditEntry(e)}>✏️</button>
                    <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ id: e.id, description: e.description, hasLedger: !!e.accountHeadID })}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {masterAction && (
        <MasterCodeModal
          title={masterAction.hasLedger ? '🗑️ Delete + Reverse Ledger' : '🗑️ Delete Entry'}
          subtitle={masterAction.description ? `"${masterAction.description}"${masterAction.hasLedger ? '\n✅ Ledger will auto-reverse.' : ''}` : undefined}
          onSuccess={() => handleDelete(masterAction.id)}
          onCancel={() => setMasterAction(null)}
        />
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

function TaxRegister() {
  const { data, refreshData } = useApp()
  const [monthFilter, setMonthFilter] = useState('')
  const [partyFilter, setPartyFilter] = useState('')
  const [whtFilter, setWhtFilter] = useState('')
  const [challanFilter, setChallanFilter] = useState('')
  const [updating, setUpdating] = useState(null)

  const whtEntries = useMemo(() => {
    return (data.dayBook || []).filter(e => (e.wallet || '').toLowerCase() === 'tax head')
  }, [data.dayBook])

  const months = useMemo(() => {
    const s = new Set()
    whtEntries.forEach(e => { if (e.date) s.add(e.date.slice(0, 7)) })
    return [...s].sort().reverse()
  }, [whtEntries])

  const parties = useMemo(() => {
    const s = new Set()
    whtEntries.forEach(e => { if (e.partyName) s.add(e.partyName) })
    return [...s].sort()
  }, [whtEntries])

  const whtPcts = useMemo(() => {
    const s = new Set()
    whtEntries.forEach(e => { if (e.whtPct != null) s.add(String(e.whtPct)) })
    return [...s].sort((a, b) => parseFloat(a) - parseFloat(b))
  }, [whtEntries])

  const filtered = useMemo(() => {
    return whtEntries.filter(e => {
      if (monthFilter && !(e.date || '').startsWith(monthFilter)) return false
      if (partyFilter && e.partyName !== partyFilter) return false
      if (whtFilter && String(e.whtPct) !== whtFilter) return false
      if (challanFilter && (e.challanStatus || 'pending') !== challanFilter) return false
      return true
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [whtEntries, monthFilter, partyFilter, whtFilter, challanFilter])

  const partySummary = useMemo(() => {
    const map = {}
    filtered.forEach(e => {
      const key = e.partyName || '(Unknown Party)'
      if (!map[key]) map[key] = { partyName: key, accountHeadID: e.accountHeadID || '', count: 0, totalGross: 0, totalWHT: 0, pending: 0, obtained: 0 }
      const wht = parseFloat(e.amount) || parseFloat(e.debit) || parseFloat(e.credit) || 0
      const gross = parseFloat(e.grossAmount) || 0
      map[key].count++
      map[key].totalGross += gross
      map[key].totalWHT += wht
      if ((e.challanStatus || 'pending') === 'obtained') map[key].obtained++
      else map[key].pending++
    })
    return Object.values(map).sort((a, b) => b.totalWHT - a.totalWHT)
  }, [filtered])

  const totals = useMemo(() => ({
    gross: filtered.reduce((s, e) => s + (parseFloat(e.grossAmount) || 0), 0),
    wht: filtered.reduce((s, e) => s + (parseFloat(e.amount) || parseFloat(e.debit) || parseFloat(e.credit) || 0), 0),
    pending: filtered.filter(e => (e.challanStatus || 'pending') === 'pending').length,
    obtained: filtered.filter(e => e.challanStatus === 'obtained').length,
  }), [filtered])

  async function toggleChallan(entry) {
    const newStatus = (entry.challanStatus || 'pending') === 'pending' ? 'obtained' : 'pending'
    setUpdating(entry.id)
    try {
      await fetch(`/api/dayBook/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, challanStatus: newStatus })
      })
      await refreshData()
      toast.success(`Challan marked ${newStatus}`)
    } catch {
      toast.error('Update failed')
    } finally {
      setUpdating(null)
    }
  }

  function exportCSV() {
    const rows = [['Date', 'Party', 'Account Head', 'Doc Ref', 'WHT %', 'Gross Amount', 'WHT Amount', 'Net Amount', 'Party Type', 'Challan Status']]
    filtered.forEach(e => {
      const grossAmt = parseFloat(e.grossAmount) || 0
      const wht = parseFloat(e.debit) || parseFloat(e.credit) || parseFloat(e.amount) || 0
      const netAmt = Math.max(grossAmt - wht, 0)
      rows.push([e.date || '', e.partyName || '', e.accountHeadID || '', e.reference || '', e.whtPct || 0, grossAmt, wht, netAmt, e.partyType || '', e.challanStatus || 'pending'])
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `tax-register-${monthFilter || 'all'}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="section-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>🧾 Tax Deduction Register (WHT)</div>
        <button className="btn btn-secondary btn-sm" onClick={exportCSV}>📥 Export CSV</button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {[
          { label: 'Total Gross', value: `PKR ${totals.gross.toLocaleString()}`, color: 'var(--blue)' },
          { label: 'Total WHT Deducted', value: `PKR ${totals.wht.toLocaleString()}`, color: 'var(--amber)' },
          { label: 'Challan Pending', value: totals.pending, color: 'var(--red)' },
          { label: 'Challan Obtained', value: totals.obtained, color: 'var(--green)' },
        ].map(c => (
          <div key={c.label} className="wallet-card glass" style={{ padding: '12px 18px', minWidth: 140 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <select className="input" style={{ width: 150 }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
          <option value="">All Months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="input" style={{ width: 180 }} value={partyFilter} onChange={e => setPartyFilter(e.target.value)}>
          <option value="">All Parties</option>
          {parties.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input" style={{ width: 120 }} value={whtFilter} onChange={e => setWhtFilter(e.target.value)}>
          <option value="">All WHT %</option>
          {whtPcts.map(p => <option key={p} value={p}>{p}%</option>)}
        </select>
        <select className="input" style={{ width: 150 }} value={challanFilter} onChange={e => setChallanFilter(e.target.value)}>
          <option value="">All Challan Status</option>
          <option value="pending">Pending</option>
          <option value="obtained">Obtained</option>
        </select>
        {(monthFilter || partyFilter || whtFilter || challanFilter) && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setMonthFilter(''); setPartyFilter(''); setWhtFilter(''); setChallanFilter('') }}>✕ Clear</button>
        )}
      </div>

      {/* Party Summary */}
      {partySummary.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Party-wise Summary</div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Party</th><th>Account Head</th><th>Transactions</th>
                  <th>Total Gross</th><th>Total WHT</th><th>Pending</th><th>Obtained</th>
                </tr>
              </thead>
              <tbody>
                {partySummary.map(p => (
                  <tr key={p.partyName}>
                    <td className="bold">{p.partyName}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.accountHeadID || '—'}</td>
                    <td style={{ textAlign: 'center' }}>{p.count}</td>
                    <td className="bold">PKR {p.totalGross.toLocaleString()}</td>
                    <td className="bold" style={{ color: 'var(--amber)' }}>PKR {p.totalWHT.toLocaleString()}</td>
                    <td style={{ color: p.pending > 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: p.pending > 0 ? 700 : 400 }}>{p.pending}</td>
                    <td style={{ color: p.obtained > 0 ? 'var(--green)' : 'var(--text-muted)', fontWeight: p.obtained > 0 ? 700 : 400 }}>{p.obtained}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
        Transaction Detail ({filtered.length} entries)
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          No WHT entries found. WHT deductions appear here when payments include a WHT amount.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Date</th><th>Party</th><th>Account Head</th><th>Doc Ref</th>
                <th>WHT %</th><th>Gross Amt</th><th>WHT Amt</th><th>Net Amt</th>
                <th>Type</th><th>Challan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const grossAmt = parseFloat(e.grossAmount) || 0
                const wht = parseFloat(e.debit) || parseFloat(e.credit) || parseFloat(e.amount) || 0
                const netAmt = Math.max(grossAmt - wht, 0)
                const status = e.challanStatus || 'pending'
                return (
                  <tr key={e.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td className="bold">{e.partyName || '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{e.accountHeadID || '—'}</td>
                    <td style={{ fontSize: 11 }}>{e.reference || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{e.whtPct ? `${e.whtPct}%` : '—'}</td>
                    <td className="bold">PKR {grossAmt.toLocaleString()}</td>
                    <td className="bold" style={{ color: 'var(--amber)' }}>PKR {wht.toLocaleString()}</td>
                    <td className="bold" style={{ color: 'var(--green)' }}>PKR {netAmt.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${e.partyType === 'client' ? 'badge-paid' : 'badge-pending'}`} style={{ fontSize: 10 }}>
                        {e.partyType === 'client' ? '👤 Client' : '🏭 Supplier'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-xs ${status === 'obtained' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => toggleChallan(e)}
                        disabled={updating === e.id}
                        style={{ minWidth: 80, fontSize: 10 }}
                      >
                        {updating === e.id ? '...' : status === 'obtained' ? '✅ Obtained' : '⏳ Pending'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
        {[['daybook', '📒 Day Book'], ['advances', '💳 Advances'], ['taxreg', '🧾 Tax Register']].map(([key, label]) => (
          <button key={key} className={`tab-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>

      {tab === 'daybook' && <DayBook />}
      {tab === 'advances' && <Advances />}
      {tab === 'taxreg' && <TaxRegister />}
    </div>
  )
}
