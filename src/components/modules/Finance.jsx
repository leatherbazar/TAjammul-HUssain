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

const DEFAULT_CATEGORIES = {
  income:             ['Client Payment', 'Sales Recovery', 'Refund Received', 'Commission', 'Other Income'],
  expense:            ['Supplier Payment', 'Salary', 'Rent', 'Utilities', 'Transport', 'Office Expense', 'Repair & Maintenance', 'Miscellaneous'],
  'advance-given':    ['To Supplier', 'To Employee', 'To Other'],
  'advance-received': ['From Client', 'From Partner', 'From Other'],
  transfer:           ['Cash → Bank', 'Bank → Cash', 'Cash → JazzCash', 'JazzCash → Cash', 'Cash → EasyPaisa', 'EasyPaisa → Cash'],
}

// Type config: label, color, amount direction, icon
const TYPE_CONFIG = {
  income:             { label: 'Money Received',   icon: '💰', color: 'var(--green)',   hint: 'Cash coming IN to your business',   amountLabel: 'Amount Received (PKR)', debit: true,  credit: false },
  expense:            { label: 'Money Paid Out',   icon: '💸', color: 'var(--red)',     hint: 'Cash going OUT of your business',   amountLabel: 'Amount Paid (PKR)',     debit: false, credit: true  },
  'advance-given':    { label: 'Advance Given',    icon: '📤', color: 'var(--amber)',   hint: 'You are giving advance to someone', amountLabel: 'Advance Amount (PKR)',  debit: false, credit: true  },
  'advance-received': { label: 'Advance Received', icon: '📥', color: 'var(--blue)',    hint: 'You received advance from someone', amountLabel: 'Amount Received (PKR)', debit: true,  credit: false },
  transfer:           { label: 'Internal Transfer',icon: '🔄', color: 'var(--text-muted)', hint: 'Moving money between your own wallets', amountLabel: 'Transfer Amount (PKR)', debit: true, credit: true },
}

// Auto-generate description
function autoDesc(type, category, party, ref) {
  if (!category && !party) return ''
  const p = party ? ` — ${party}` : ''
  const r = ref ? ` (${ref})` : ''
  if (category === 'Client Payment')    return `Payment received${r}${p}`
  if (category === 'Supplier Payment')  return `Payment paid to${p}${r}`
  if (category === 'Salary')            return `Salary paid${p}`
  if (category === 'To Supplier')       return `Advance to supplier${p}`
  if (category === 'To Employee')       return `Advance to employee${p}`
  if (category === 'From Client')       return `Advance received${r}${p}`
  return `${category || type}${p}${r}`
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
              {(DEFAULT_CATEGORIES[form.type] || []).map(c => <option key={c}>{c}</option>)}
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
  const { data, refreshData, currentCompany, currentCompanyId } = useApp()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income', description: '', amount: '',
    wallet: 'Cash', reference: '', category: 'Client Payment',
    partyName: '', accountHeadID: '',
  })
  const [addingSaving, setAddingSaving] = useState(false)
  const [newCatInput, setNewCatInput] = useState('')
  const [showCatAdd, setShowCatAdd] = useState(false)
  const [masterAction, setMasterAction] = useState(null)
  const [editEntry, setEditEntry] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [softDeleted, setSoftDeleted] = useState(new Set())
  // Ref map of id → undone flag — avoids stale closure issues with rapid deletes
  const undoneMap = React.useRef({})

  const entries = useMemo(() => {
    let list = [...(data.dayBook || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
    if (search) list = list.filter(e => e.description?.toLowerCase().includes(search.toLowerCase()) || e.reference?.includes(search))
    if (typeFilter !== 'all') list = list.filter(e => e.type === typeFilter)
    list = list.filter(e => !softDeleted.has(e.id))
    return list
  }, [data.dayBook, search, typeFilter, softDeleted])

  const totals = useMemo(() => entries.reduce((acc, e) => ({ debit: acc.debit + (parseFloat(e.debit) || 0), credit: acc.credit + (parseFloat(e.credit) || 0) }), { debit: 0, credit: 0 }), [entries])

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Get categories: defaults + any custom ones stored in settings
  const getCategories = (type) => {
    const defaults = DEFAULT_CATEGORIES[type] || []
    const custom = (data.settings?.customCategories?.[type]) || []
    return [...new Set([...defaults, ...custom])]
  }

  // Relevant invoices for selected party (for reference dropdown)
  const partyInvoices = useMemo(() => {
    if (!form.partyName) return []
    if (form.type === 'income') {
      return (data.invoices || [])
        .filter(i => i.clientName === form.partyName && i.status !== 'paid' && i.status !== 'cancelled')
        .slice(0, 20)
    }
    if (form.type === 'expense' || form.type === 'advance-given') {
      return (data.purchases || [])
        .filter(p => p.supplierName === form.partyName && p.paymentStatus !== 'paid')
        .slice(0, 20)
    }
    return []
  }, [form.partyName, form.type, data.invoices, data.purchases])

  const handleAdd = async () => {
    if (!form.description) { toast.error('Description required.'); return }
    const amt = parseFloat(form.amount) || 0
    if (!amt) { toast.error('Enter an amount.'); return }
    if (addingSaving) return
    setAddingSaving(true)

    // Determine debit/credit from type
    const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG.income
    let debit = 0, credit = 0
    if (form.type === 'transfer') { debit = amt; credit = amt }
    else if (cfg.debit)  debit  = amt
    else                 credit = amt

    const entry = { ...form, debit, credit }
    try {
      const res = await fetch('/api/dayBook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...entry, id: Date.now().toString(), createdAt: new Date().toISOString(), companyId: currentCompanyId }),
      })
      const saved = await res.json()
      if (!res.ok) { toast.error(saved.error || 'Failed to save entry'); return }
      await refreshData()
      setForm(f => ({ ...f, description: '', amount: '', reference: '', partyName: '', accountHeadID: '' }))
      toast.success('Entry added & ledger updated!')
    } catch {
      toast.error('Connection error.')
    } finally {
      setAddingSaving(false)
    }
  }

  const handleAddCustomCategory = () => {
    const cat = newCatInput.trim()
    if (!cat) return
    const existing = data.settings?.customCategories || {}
    const updated = { ...existing, [form.type]: [...new Set([...(existing[form.type] || []), cat])] }
    // Save to settings via API
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customCategories: updated }),
    }).then(() => refreshData())
    setField('category', cat)
    setNewCatInput('')
    setShowCatAdd(false)
    toast.success(`Category "${cat}" added!`)
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

      {/* ── Add Entry – User-friendly Voucher ─────────────────────────── */}
      {(() => {
        const cfg = TYPE_CONFIG[form.type] || TYPE_CONFIG.income
        const cats = getCategories(form.type)
        return (
          <div style={{ padding: 16, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${cfg.color}44`, marginBottom: 16 }}>
            {/* Step 1: Transaction Type Selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Step 1 — What kind of transaction?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(TYPE_CONFIG).map(([key, c]) => (
                  <button
                    key={key}
                    onClick={() => {
                      const newCat = DEFAULT_CATEGORIES[key]?.[0] || ''
                      setForm(f => ({ ...f, type: key, category: newCat, description: autoDesc(key, newCat, f.partyName, f.reference) }))
                    }}
                    style={{
                      padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                      border: `2px solid ${form.type === key ? c.color : 'var(--glass-border)'}`,
                      background: form.type === key ? `${c.color}22` : 'transparent',
                      color: form.type === key ? c.color : 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                  >{c.icon} {c.label}</button>
                ))}
              </div>
              {/* Hint */}
              <div style={{ marginTop: 6, fontSize: 12, color: cfg.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{cfg.icon}</span>
                <span>{cfg.hint}</span>
                {form.type !== 'transfer' && (
                  <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                    {cfg.debit ? '→ Ledger: Debit party' : '→ Ledger: Credit party'}
                  </span>
                )}
              </div>
            </div>

            {/* Debit / Credit direction banner */}
            {(() => {
              const isDebit  = form.type === 'expense' || form.type === 'advance-given'
              const isCredit = form.type === 'income'  || form.type === 'advance-received'
              const isTransfer = form.type === 'transfer'
              return (
                <div style={{ display: 'flex', gap: 10, marginBottom: 14, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                  {/* DEBIT side */}
                  <div style={{
                    flex: 1, padding: '10px 14px', textAlign: 'center',
                    background: (isDebit || isTransfer) ? 'rgba(220,38,38,0.18)' : 'rgba(255,255,255,0.03)',
                    borderRight: '1px solid var(--glass-border)',
                    opacity: (!isDebit && !isTransfer) ? 0.4 : 1,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: 1 }}>Dr — Debit</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {form.type === 'expense'       && '💸 Money going OUT'}
                      {form.type === 'advance-given' && '📤 Advance being paid out'}
                      {form.type === 'transfer'      && '🔄 Leaving source wallet'}
                      {(form.type === 'income' || form.type === 'advance-received') && '✖ Not applicable'}
                    </div>
                    {(isDebit || isTransfer) && form.amount && (
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--red)', fontFamily: 'Orbitron, monospace', marginTop: 4 }}>
                        PKR {Number(form.amount).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {/* CREDIT side */}
                  <div style={{
                    flex: 1, padding: '10px 14px', textAlign: 'center',
                    background: (isCredit || isTransfer) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                    opacity: (!isCredit && !isTransfer) ? 0.4 : 1,
                    transition: 'all 0.2s',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: 1 }}>Cr — Credit</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {form.type === 'income'            && '💰 Money coming IN'}
                      {form.type === 'advance-received'  && '📥 Advance being received'}
                      {form.type === 'transfer'          && '🔄 Entering destination wallet'}
                      {(form.type === 'expense' || form.type === 'advance-given') && '✖ Not applicable'}
                    </div>
                    {(isCredit || isTransfer) && form.amount && (
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--green)', fontFamily: 'Orbitron, monospace', marginTop: 4 }}>
                        PKR {Number(form.amount).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Step 2: Main Fields */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Step 2 — Fill details</div>
              <div className="form-grid form-grid-3">
                {/* Date */}
                <div className="input-group">
                  <label className="input-label">📅 Date</label>
                  <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
                </div>

                {/* Amount */}
                <div className="input-group">
                  <label className="input-label" style={{ color: cfg.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cfg.amountLabel}
                    <span style={{
                      padding: '1px 8px', borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                      background: (form.type === 'expense' || form.type === 'advance-given') ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.2)',
                      color:      (form.type === 'expense' || form.type === 'advance-given') ? 'var(--red)' : 'var(--green)',
                      border:     `1px solid ${(form.type === 'expense' || form.type === 'advance-given') ? 'rgba(220,38,38,0.4)' : 'rgba(34,197,94,0.4)'}`,
                    }}>
                      {form.type === 'transfer' ? 'Dr + Cr' : (form.type === 'expense' || form.type === 'advance-given') ? '↑ DEBIT' : '↓ CREDIT'}
                    </span>
                  </label>
                  <input
                    type="number" className="input" min="0" step="1"
                    value={form.amount}
                    onChange={e => setField('amount', e.target.value)}
                    placeholder="0"
                    style={{ borderColor: form.amount ? cfg.color : undefined, fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700 }}
                  />
                </div>

                {/* Wallet */}
                <div className="input-group">
                  <label className="input-label">👛 Wallet</label>
                  <select className="input" value={form.wallet} onChange={e => setField('wallet', e.target.value)}>
                    {WALLETS.map(w => <option key={w}>{WALLET_ICONS[w]} {w}</option>)}
                  </select>
                </div>

                {/* Party / Contact */}
                <div className="input-group">
                  <label className="input-label">👤 Party / Account</label>
                  <ContactSelect
                    value={form.partyName}
                    onChange={(name, contact) => {
                      setField('partyName', name)
                      if (contact) setField('accountHeadID', contact.accountHeadID || '')
                      else setField('accountHeadID', '')
                      setForm(f => ({ ...f, partyName: name, accountHeadID: contact?.accountHeadID || '', description: autoDesc(f.type, f.category, name, f.reference) }))
                    }}
                    placeholder="Search contact..."
                  />
                  {form.accountHeadID && (
                    <div style={{ fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--blue)', fontWeight: 700 }}>{form.accountHeadID}</span>
                      <span style={{ padding: '2px 7px', borderRadius: 5, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.35)', color: 'var(--green)', fontWeight: 700, fontSize: 10 }}>
                        ✅ Ledger auto-updates
                      </span>
                    </div>
                  )}
                </div>

                {/* Category */}
                <div className="input-group">
                  <label className="input-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🏷️ Category
                      {form.category && (
                        <span style={{
                          marginLeft: 8, padding: '1px 7px', borderRadius: 5, fontSize: 10, fontWeight: 800,
                          background: cfg.debit ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.2)',
                          color:      cfg.debit ? 'var(--red)' : 'var(--green)',
                          border:     `1px solid ${cfg.debit ? 'rgba(220,38,38,0.4)' : 'rgba(34,197,94,0.4)'}`,
                        }}>
                          {form.type === 'transfer' ? 'Dr + Cr' : cfg.debit ? 'Dr (Debit)' : 'Cr (Credit)'}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCatAdd(v => !v)}
                      style={{ fontSize: 11, color: 'var(--blue)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', fontWeight: 700 }}
                    >＋ Add</button>
                  </label>
                  {showCatAdd ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input className="input" placeholder="New category name..." value={newCatInput} onChange={e => setNewCatInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCustomCategory() }} autoFocus style={{ flex: 1 }} />
                      <button className="btn btn-primary btn-sm" onClick={handleAddCustomCategory}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => { setShowCatAdd(false); setNewCatInput('') }}>✕</button>
                    </div>
                  ) : (
                    <select className="input" value={form.category} onChange={e => {
                      const cat = e.target.value
                      setForm(f => ({ ...f, category: cat, description: autoDesc(f.type, cat, f.partyName, f.reference) }))
                    }}
                    style={{ borderColor: form.category ? (cfg.debit ? 'var(--red)' : 'var(--green)') : undefined }}>
                      <option value="">— Select —</option>
                      {cats.map(c => <option key={c}>{c}</option>)}
                    </select>
                  )}
                </div>

                {/* Invoice / Reference dropdown */}
                <div className="input-group">
                  <label className="input-label">🔗 Invoice / Ref</label>
                  {partyInvoices.length > 0 ? (
                    <select className="input" value={form.reference} onChange={e => {
                      const ref = e.target.value
                      setForm(f => ({ ...f, reference: ref, description: autoDesc(f.type, f.category, f.partyName, ref) }))
                    }}>
                      <option value="">— Select or type below —</option>
                      {partyInvoices.map(i => (
                        <option key={i.id} value={i.number || i.invoiceNumber}>
                          {i.number || i.invoiceNumber} — PKR {Number(i.total || i.grandTotal || 0).toLocaleString()} ({i.status || i.paymentStatus || 'pending'})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input className="input" value={form.reference} onChange={e => {
                      const ref = e.target.value
                      setForm(f => ({ ...f, reference: ref, description: autoDesc(f.type, f.category, f.partyName, ref) }))
                    }} placeholder="INV-201, SO-001..." />
                  )}
                </div>

                {/* Description (auto-filled, editable) */}
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">📝 Description <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>(auto-filled — you can edit)</span></label>
                  <input className="input" value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="Description will appear here automatically..."
                    spellCheck
                  />
                </div>
              </div>
            </div>

            {/* Add Button */}
            <button
              className="btn btn-primary w-full"
              onClick={handleAdd}
              disabled={addingSaving}
              style={{ fontSize: 15, padding: '10px 0', background: addingSaving ? undefined : cfg.color, opacity: addingSaving ? 0.6 : 1 }}
            >
              {addingSaving ? '⏳ Saving…' : `${cfg.icon} Record ${cfg.label}`}
            </button>
          </div>
        )
      })()}

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
  const { data, deleteRecord, refreshData, currentCompanyId } = useApp()
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'client-to-admin', from: '', to: '',
    fromAccountHeadID: '', toAccountHeadID: '',
    amount: '', invoiceRef: '', description: '', status: 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [masterAction, setMasterAction] = useState(null)
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const advances = data.advances || []
  const total     = advances.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)
  const recovered = advances.filter(a => a.status === 'recovered').reduce((s, a) => s + (parseFloat(a.amount) || 0), 0)

  // Which party's invoices to show depends on type
  const clientParty   = form.type === 'client-to-admin' ? form.from : ''
  const supplierParty = form.type === 'admin-to-supplier' ? form.to : ''

  const linkedInvoices = useMemo(() => {
    if (clientParty) {
      return (data.invoices || []).filter(i =>
        i.clientName === clientParty && i.status !== 'paid' && i.status !== 'cancelled'
      ).sort((a, b) => (b.number || '').localeCompare(a.number || ''))
    }
    if (supplierParty) {
      return (data.purchases || []).filter(p =>
        p.supplierName === supplierParty && p.paymentStatus !== 'paid'
      ).sort((a, b) => new Date(b.date) - new Date(a.date))
    }
    return []
  }, [clientParty, supplierParty, data.invoices, data.purchases])

  // Selected invoice details for preview
  const selectedInv = useMemo(() => {
    if (!form.invoiceRef) return null
    return (data.invoices || []).find(i => i.number === form.invoiceRef)
      || (data.purchases || []).find(p => p.number === form.invoiceRef)
  }, [form.invoiceRef, data.invoices, data.purchases])

  const handleRecord = async () => {
    if (!form.amount || !form.from) { toast.error('Fill From and Amount.'); return }
    if (saving) return
    setSaving(true)
    const loadId = toast.loading('Recording advance…')
    try {
      const res = await fetch('/api/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: Date.now().toString(), createdAt: new Date().toISOString(), companyId: currentCompanyId }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Server error') }

      // If linked to an invoice, update its advancePaid + status
      if (form.invoiceRef && selectedInv) {
        const prevPaid = parseFloat(selectedInv.advancePaid) || 0
        const total_inv = parseFloat(selectedInv.total || selectedInv.grandTotal) || 0
        const newPaid   = prevPaid + (parseFloat(form.amount) || 0)
        const newStatus = newPaid >= total_inv ? 'paid' : 'partial'
        await fetch(`/api/invoices/${selectedInv.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advancePaid: newPaid, status: newStatus }),
        })
      }

      await refreshData()
      toast.dismiss(loadId)
      toast.success('Advance recorded!')
      setForm(f => ({ ...f, from: '', to: '', fromAccountHeadID: '', toAccountHeadID: '', amount: '', invoiceRef: '', description: '' }))
    } catch (err) {
      toast.dismiss(loadId)
      toast.error(err.message || 'Failed to record.')
    } finally {
      setSaving(false)
    }
  }

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
        <div className="form-grid form-grid-3">

          {/* Date */}
          <div className="input-group">
            <label className="input-label">📅 Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>

          {/* Type */}
          <div className="input-group">
            <label className="input-label">🔀 Type</label>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, from: '', to: '', fromAccountHeadID: '', toAccountHeadID: '', invoiceRef: '' }))}>
              <option value="client-to-admin">Client → Admin (Received)</option>
              <option value="admin-to-supplier">Admin → Supplier (Given)</option>
              <option value="admin-to-employee">Admin → Employee (Given)</option>
            </select>
          </div>

          {/* Amount */}
          <div className="input-group">
            <label className="input-label">💰 Amount (PKR)</label>
            <input type="number" className="input" min="0" step="1" value={form.amount}
              onChange={e => setField('amount', e.target.value)}
              placeholder="0"
              style={{ fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700,
                borderColor: form.type === 'client-to-admin' ? 'var(--green)' : 'var(--amber)' }} />
          </div>

          {/* FROM — ContactSelect */}
          <div className="input-group">
            <label className="input-label">
              👤 From
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                {form.type === 'client-to-admin' ? '(Client paying)' : '(Admin / Company)'}
              </span>
            </label>
            <ContactSelect
              value={form.from}
              onChange={(name, contact) => setForm(f => ({ ...f, from: name, fromAccountHeadID: contact?.accountHeadID || '', invoiceRef: '' }))}
              placeholder={form.type === 'client-to-admin' ? 'Search client...' : 'Search contact...'}
            />
            {form.fromAccountHeadID && (
              <div style={{ fontSize: 10, marginTop: 3, color: 'var(--blue)', fontFamily: 'monospace', fontWeight: 700 }}>{form.fromAccountHeadID}</div>
            )}
          </div>

          {/* TO — ContactSelect */}
          <div className="input-group">
            <label className="input-label">
              👤 To
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                {form.type === 'admin-to-supplier' ? '(Supplier receiving)' : form.type === 'admin-to-employee' ? '(Employee receiving)' : '(Admin / Company)'}
              </span>
            </label>
            <ContactSelect
              value={form.to}
              onChange={(name, contact) => setForm(f => ({ ...f, to: name, toAccountHeadID: contact?.accountHeadID || '', invoiceRef: '' }))}
              placeholder={form.type === 'admin-to-supplier' ? 'Search supplier...' : form.type === 'admin-to-employee' ? 'Search employee...' : 'Search contact...'}
            />
            {form.toAccountHeadID && (
              <div style={{ fontSize: 10, marginTop: 3, color: 'var(--blue)', fontFamily: 'monospace', fontWeight: 700 }}>{form.toAccountHeadID}</div>
            )}
          </div>

          {/* Invoice Reference — filtered dropdown */}
          <div className="input-group">
            <label className="input-label">🔗 Link to Invoice / Order
              {linkedInvoices.length > 0 && (
                <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700, background: 'rgba(59,130,246,0.2)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.4)' }}>
                  {linkedInvoices.length} open
                </span>
              )}
            </label>
            {linkedInvoices.length > 0 ? (
              <select className="input" value={form.invoiceRef}
                onChange={e => setField('invoiceRef', e.target.value)}
                style={{ borderColor: form.invoiceRef ? 'var(--blue)' : undefined }}>
                <option value="">— No link (optional) —</option>
                {linkedInvoices.map(i => {
                  const num   = i.number || i.invoiceNumber || i.id
                  const total = parseFloat(i.total || i.grandTotal) || 0
                  const paid  = parseFloat(i.advancePaid) || 0
                  const bal   = total - paid
                  const st    = i.status || i.paymentStatus || 'pending'
                  return (
                    <option key={i.id} value={num}>
                      {num} — Balance: PKR {bal.toLocaleString()} [{st}]
                    </option>
                  )
                })}
              </select>
            ) : (
              <input className="input" value={form.invoiceRef}
                onChange={e => setField('invoiceRef', e.target.value)}
                placeholder={linkedInvoices.length === 0 && (clientParty || supplierParty) ? 'No open invoices found' : 'INV-201 (select party first)'}
              />
            )}
          </div>

          {/* Invoice preview card */}
          {selectedInv && (
            <div style={{ gridColumn: '1 / -1', padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>INVOICE</span>
                <div style={{ fontWeight: 900, color: 'var(--blue)' }}>{selectedInv.number || selectedInv.invoiceNumber}</div></div>
              <div><span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL</span>
                <div style={{ fontWeight: 700 }}>PKR {Number(selectedInv.total || selectedInv.grandTotal || 0).toLocaleString()}</div></div>
              <div><span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>PAID SO FAR</span>
                <div style={{ fontWeight: 700, color: 'var(--green)' }}>PKR {Number(selectedInv.advancePaid || 0).toLocaleString()}</div></div>
              <div><span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>REMAINING BALANCE</span>
                <div style={{ fontWeight: 900, color: 'var(--red)' }}>
                  PKR {(Number(selectedInv.total || selectedInv.grandTotal || 0) - Number(selectedInv.advancePaid || 0)).toLocaleString()}
                </div></div>
              {form.amount && (
                <div style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)' }}>
                  <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>AFTER THIS PAYMENT</div>
                  <div style={{ fontWeight: 900, color: 'var(--green)', fontSize: 15 }}>
                    {Number(selectedInv.advancePaid || 0) + Number(form.amount || 0) >= Number(selectedInv.total || selectedInv.grandTotal || 0)
                      ? '✅ FULLY PAID'
                      : `PKR ${(Number(selectedInv.total || selectedInv.grandTotal || 0) - Number(selectedInv.advancePaid || 0) - Number(form.amount || 0)).toLocaleString()} still due`
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="input-group">
            <label className="input-label">📋 Status</label>
            <select className="input" value={form.status} onChange={e => setField('status', e.target.value)}>
              <option value="pending">Pending</option>
              <option value="recovered">Recovered</option>
            </select>
          </div>

          {/* Description */}
          <div className="input-group" style={{ gridColumn: 'span 2' }}>
            <label className="input-label">📝 Description</label>
            <input className="input" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Advance for order, salary advance..." spellCheck />
          </div>

          {/* Record button */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary w-full" onClick={handleRecord} disabled={saving}
              style={{ opacity: saving ? 0.6 : 1 }}>
              {saving ? '⏳ Saving…' : '💳 Record Advance'}
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Invoice</th><th>Amount</th><th>Description</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {advances.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No advances recorded.</td></tr>}
            {[...advances].sort((a, b) => new Date(b.date) - new Date(a.date)).map(adv => (
              <tr key={adv.id}>
                <td style={{ fontSize: 12 }}>{adv.date}</td>
                <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{adv.type}</td>
                <td>{adv.from}</td>
                <td>{adv.to || '—'}</td>
                <td style={{ fontSize: 11 }}>{adv.invoiceRef ? <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{adv.invoiceRef}</span> : '—'}</td>
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
