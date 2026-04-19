import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'
import { exportLedgerPDF } from '../../utils/pdfExport'

const TYPE_COLORS = { client: 'var(--green)', supplier: 'var(--amber)', staff: 'var(--blue)' }
const TYPE_LABELS  = { client: '🤝 Client',   supplier: '🏭 Supplier',  staff: '👷 Staff'   }

// ─── Record Payment Modal (for client invoices) ───────────────────────────────
function RecordPaymentModal({ invoice, contact, onClose, onSuccess }) {
  const [amount, setAmount]   = useState(Math.max((invoice.total || 0) - (invoice.advancePaid || 0), 0).toString())
  const [wallet, setWallet]   = useState('Cash')
  const [date,   setDate]     = useState(new Date().toISOString().slice(0, 10))
  const [notes,  setNotes]    = useState('')
  const [saving, setSaving]   = useState(false)

  const balance = Math.max((invoice.total || 0) - (invoice.advancePaid || 0), 0)

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    if (amt > balance + 0.01) { toast.error(`Maximum receivable is PKR ${balance.toLocaleString()}`); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amt, wallet, date, notes }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); setSaving(false); return }
      toast.success(`PKR ${amt.toLocaleString()} recorded against ${invoice.number}!`)
      onSuccess()
    } catch { toast.error('Connection error.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">💰 Record Payment — {invoice.number}</div>
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 14, fontSize: 13 }}>
          <span style={{ color: 'var(--text-muted)' }}>Invoice Total: </span>
          <strong>PKR {Number(invoice.total || 0).toLocaleString()}</strong>
          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Already Paid: </span>
          <strong style={{ color: 'var(--green)' }}>PKR {Number(invoice.advancePaid || 0).toLocaleString()}</strong>
          <span style={{ margin: '0 8px', color: 'var(--text-muted)' }}>|</span>
          <span style={{ color: 'var(--text-muted)' }}>Balance Due: </span>
          <strong style={{ color: 'var(--red)' }}>PKR {balance.toLocaleString()}</strong>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Amount Received (PKR) *</label>
            <input type="number" className="input" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus
              style={{ borderColor: 'var(--green)', fontSize: 18, fontWeight: 700 }} />
          </div>
          <div className="input-group">
            <label className="input-label">Received Via</label>
            <select className="input" value={wallet} onChange={e => setWallet(e.target.value)}>
              {['Cash','Bank','JazzCash','EasyPaisa','Cheque'].map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💰 Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Pay Supplier Modal ───────────────────────────────────────────────────────
function PaySupplierModal({ contact, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState('Cash')
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [notes,  setNotes]  = useState('')
  const [ref,    setRef]    = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      const docRef = ref || `PAY-${Date.now().toString().slice(-6)}`
      // Ledger debit entry (we paid the supplier → reduces what we owe)
      await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHeadID: contact.accountHeadID,
          contactName:   contact.name,
          date,
          description:   `Payment to ${contact.name}${notes ? ': ' + notes : ''}`,
          documentRef:   docRef,
          documentType:  'payment',
          debit: amt, credit: 0,
        }),
      })
      // DayBook expense entry (cash/bank going out)
      await fetch('/api/dayBook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now().toString(), date, type: 'expense',
          category:    'Supplier Payment',
          description: `Payment to ${contact.name}${notes ? ' — ' + notes : ''}`,
          partyName:   contact.name,
          accountHeadID: contact.accountHeadID,
          reference:   docRef,
          wallet,
          debit: amt, credit: 0,
        }),
      })
      toast.success(`PKR ${amt.toLocaleString()} paid to ${contact.name}!`)
      onSuccess()
    } catch { toast.error('Connection error.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">💸 Pay Supplier — {contact.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
          Account: <span style={{ fontFamily: 'monospace', color: 'var(--amber)', fontWeight: 700 }}>{contact.accountHeadID}</span>
          &nbsp;·&nbsp; This will post a <strong>Debit</strong> entry (reducing what you owe) and log an expense in Day Book.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Amount Paid (PKR) *</label>
            <input type="number" className="input" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus
              style={{ borderColor: amount ? 'var(--amber)' : undefined, fontSize: 18, fontWeight: 700 }} />
          </div>
          <div className="input-group">
            <label className="input-label">Paid Via</label>
            <select className="input" value={wallet} onChange={e => setWallet(e.target.value)}>
              {['Cash','Bank','JazzCash','EasyPaisa','Cheque'].map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Reference (optional)</label>
            <input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="Cheque#, PO#..." />
          </div>
          <div className="input-group col-span-2">
            <label className="input-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What is this payment for?" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-warning w-full" onClick={handleSave} disabled={saving}
            style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid var(--amber)', color: 'var(--amber)', fontWeight: 700 }}>
            {saving ? 'Saving...' : '💸 Record Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Edit Account ID Modal ────────────────────────────────────────────────────
function EditAccountIDModal({ contact, onClose, onSuccess }) {
  const [newID, setNewID] = useState(contact.accountHeadID || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const val = newID.trim().toUpperCase()
    if (!val) { toast.error('Enter a valid ID'); return }
    if (val === contact.accountHeadID) { onClose(); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/reassign-id`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newAccountHeadID: val }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed'); setSaving(false); return }
      toast.success(`Account ID updated: ${data.oldID} → ${data.newID}`)
      onSuccess(data.contact)
    } catch { toast.error('Connection error.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">🔢 Edit Account ID — {contact.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
          Current: <span style={{ fontFamily: 'monospace', color: 'var(--amber)', fontWeight: 700 }}>{contact.accountHeadID}</span>
          <br />All ledger entries, invoices &amp; purchases will be migrated to the new ID.
        </div>
        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">New Account ID (e.g. CLI-001)</label>
          <input
            className="input" value={newID}
            onChange={e => setNewID(e.target.value.toUpperCase())}
            placeholder="CLI-001" autoFocus
            style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Migrating...' : '💾 Save & Migrate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Receive Advance Modal ────────────────────────────────────────────────────
function ReceiveAdvanceModal({ contact, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [wallet, setWallet] = useState('Cash')
  const [date,   setDate]   = useState(new Date().toISOString().slice(0, 10))
  const [notes,  setNotes]  = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    try {
      // Ledger credit entry
      await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountHeadID: contact.accountHeadID,
          contactName:   contact.name,
          date,
          description:   `Advance received from ${contact.name}${notes ? ': ' + notes : ''}`,
          documentRef:   `ADV-${Date.now()}`,
          documentType:  'payment',
          debit: 0, credit: amt,
        }),
      })
      // DayBook income entry
      await fetch('/api/dayBook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: Date.now().toString(), date, type: 'income',
          category:    'Advance Received',
          description: `Advance from ${contact.name}`,
          partyName: contact.name, accountHeadID: contact.accountHeadID,
          wallet, debit: amt, credit: 0,
        }),
      })
      toast.success(`Advance of PKR ${amt.toLocaleString()} recorded!`)
      onSuccess()
    } catch { toast.error('Connection error.'); setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">💵 Receive Advance — {contact.name}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Amount (PKR) *</label>
            <input type="number" className="input" value={amount}
              onChange={e => setAmount(e.target.value)} placeholder="0.00" autoFocus
              style={{ borderColor: amount ? 'var(--green)' : undefined }} />
          </div>
          <div className="input-group">
            <label className="input-label">Received In</label>
            <select className="input" value={wallet} onChange={e => setWallet(e.target.value)}>
              {['Cash','Bank','JazzCash','EasyPaisa'].map(w => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary w-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : '💵 Record Advance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Ledger Component ────────────────────────────────────────────────────
export default function Ledger() {
  const { data, refreshData } = useApp()
  const [contacts, setContacts]         = useState([])
  const [selected, setSelected]         = useState(null)
  const [loading, setLoading]           = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [search, setSearch]             = useState('')
  const [typeFilter, setTypeFilter]     = useState('all')
  const [editIDFor, setEditIDFor]       = useState(null)
  const [advanceFor, setAdvanceFor]     = useState(null)
  const [payInvoice, setPayInvoice]     = useState(null)
  const [paySupplier, setPaySupplier]   = useState(null)

  const loadContacts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contacts')
      const d = await res.json()
      setContacts(d.contacts || [])
    } catch { toast.error('Failed to load contacts') }
    finally  { setLoading(false) }
  }

  useEffect(() => { loadContacts() }, [])

  const loadLedger = async (contact) => {
    setLedgerLoading(true)
    try {
      const res = await fetch(`/api/ledger/${contact.accountHeadID}`)
      const d = await res.json()
      // Refresh contact balance from server
      const updatedContact = d.contact || contact
      setSelected({ contact: updatedContact, entries: d.entries || [] })
    } catch { toast.error('Failed to load ledger') }
    finally  { setLedgerLoading(false) }
  }

  const reloadLedger = async () => {
    if (!selected) return
    await Promise.all([loadContacts(), loadLedger(selected.contact), refreshData()])
  }

  const filtered = contacts.filter(c => {
    const matchType   = typeFilter === 'all' || c.type === typeFilter
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.accountHeadID?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    return matchType && matchSearch
  })

  // ── Account Statement view ───────────────────────────────────────────────────
  if (selected) {
    const { contact, entries } = selected
    const ledgerDebit   = entries.reduce((s, e) => s + (e.debit  || 0), 0)
    const ledgerCredit  = entries.reduce((s, e) => s + (e.credit || 0), 0)

    const isClient   = contact.type === 'client'
    const isSupplier = contact.type === 'supplier'

    // ── Client invoices (strict accountHeadID match, fallback to clientName) ──
    const allInvoices = data.invoices || []
    const clientInvoices = allInvoices.filter(i =>
      i.accountHeadID
        ? i.accountHeadID === contact.accountHeadID
        : i.clientName?.toLowerCase() === contact.name?.toLowerCase()
    )
    const pendingInvoices   = clientInvoices.filter(i => i.status !== 'paid')
    const paidInvoices      = clientInvoices.filter(i => i.status === 'paid')
    const totalInvoiced     = clientInvoices.reduce((s, i) => s + (i.total || 0), 0)
    const totalAdvancePaid  = clientInvoices.reduce((s, i) => s + (i.advancePaid || 0), 0)
    const totalPending      = clientInvoices.reduce((s, i) => s + Math.max((i.total || 0) - (i.advancePaid || 0), 0), 0)
    const totalPaid         = paidInvoices.reduce((s, i) => s + (i.total || 0), 0)

    // ── Supplier purchases ──────────────────────────────────────────────────────
    const allPurchases = data.purchases || []
    const supplierPurchases = allPurchases.filter(p =>
      p.accountHeadID
        ? p.accountHeadID === contact.accountHeadID
        : p.supplierName?.toLowerCase() === contact.name?.toLowerCase()
    )
    const totalPurchased   = supplierPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)
    const totalPaidToSupp  = supplierPurchases.reduce((s, p) => s + (p.amountPaid || 0), 0)
    const totalOwedToSupp  = supplierPurchases.reduce((s, p) => s + Math.max((p.totalAmount || 0) - (p.amountPaid || 0), 0), 0)

    // ── Summary boxes ───────────────────────────────────────────────────────────
    // Client:   Dr = invoiced, Cr = received,  Balance = outstanding AR
    // Supplier: Dr = paid out, Cr = purchased, Balance = outstanding AP
    // Staff:    raw ledger entries
    const totalDebit    = isClient   ? totalInvoiced   : isSupplier ? ledgerDebit   : ledgerDebit
    const totalCredit   = isClient   ? totalAdvancePaid: isSupplier ? totalPurchased: ledgerCredit
    const currentBalance = isClient  ? totalPending    : isSupplier ? totalOwedToSupp: (contact.currentBalance || 0)

    // Running balance for entries
    let running = 0
    const enriched = entries.map(e => {
      running = running + (e.debit || 0) - (e.credit || 0)
      return { ...e, _runBal: running }
    })

    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>📗 <span>Account Statement</span></h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {contact.type === 'client' && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setAdvanceFor(contact)}
                style={{ borderColor: 'var(--green)', color: 'var(--green)' }}>
                💵 Receive Advance
              </button>
            )}
            {contact.type === 'supplier' && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => setPaySupplier(contact)}
                style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
                💸 Pay Supplier
              </button>
            )}
            <button className="btn btn-secondary btn-sm"
              onClick={() => setEditIDFor(contact)}
              style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}>
              🔢 Edit Account ID
            </button>
            <button className="btn btn-secondary btn-sm"
              onClick={() => exportLedgerPDF(contact, entries)}
              style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}>
              🖨️ Print PDF
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>← Back</button>
          </div>
        </div>

        {/* ── Contact Header ── */}
        <div className="section-box" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: TYPE_COLORS[contact.type], fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {TYPE_LABELS[contact.type]}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 6 }}>{contact.name}</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>
                🔑 {contact.accountHeadID}
              </div>
              {contact.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📞 {contact.phone}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
                ['Total Debit (Dr)',   totalDebit,     'var(--red)'  ],
                ['Total Credit (Cr)', totalCredit,    'var(--green)'],
                ['Current Balance',   currentBalance, currentBalance >= 0 ? 'var(--green)' : 'var(--red)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ padding: '12px 18px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--glass-border)', textAlign: 'center', minWidth: 140 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 17, fontWeight: 900, color, fontFamily: 'Orbitron, monospace' }}>
                    PKR {Number(val).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Invoice Summary (clients only) ── */}
        {contact.type === 'client' && clientInvoices.length > 0 && (
          <div className="section-box" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>🧾 Invoice Summary</div>

            {/* 3 summary boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>⚠️ PENDING BALANCE</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--red)', margin: '4px 0' }}>PKR {totalPending.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pendingInvoices.length} outstanding invoices</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✅ RECOVERED</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--green)', margin: '4px 0' }}>PKR {totalPaid.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{paidInvoices.length} paid invoices</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>📄 TOTAL INVOICED</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--blue)', margin: '4px 0' }}>PKR {totalInvoiced.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{clientInvoices.length} total invoices</div>
              </div>
            </div>

            {/* Pending invoices detail */}
            {pendingInvoices.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)', marginBottom: 8 }}>⚠️ Outstanding Bills</div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Invoice #</th>
                        <th>Date</th>
                        <th>Invoice Total</th>
                        <th className="text-green">Received</th>
                        <th className="text-red">Balance Due</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingInvoices.map(inv => {
                        const bal = Math.max((inv.total || 0) - (inv.advancePaid || 0), 0)
                        return (
                          <tr key={inv.id}>
                            <td className="font-mono" style={{ color: 'var(--blue)', fontWeight: 700 }}>{inv.number || '—'}</td>
                            <td style={{ fontSize: 12 }}>{inv.date || '—'}</td>
                            <td style={{ fontWeight: 700 }}>PKR {Number(inv.total || 0).toLocaleString()}</td>
                            <td className="text-green bold">PKR {Number(inv.advancePaid || 0).toLocaleString()}</td>
                            <td className="text-red bold">PKR {Number(bal).toLocaleString()}</td>
                            <td><span className={`badge badge-${inv.status || 'unpaid'}`}>{inv.status || 'unpaid'}</span></td>
                            <td>
                              <button className="btn btn-success btn-xs"
                                onClick={() => setPayInvoice(inv)}
                                style={{ whiteSpace: 'nowrap' }}>
                                💰 Pay
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 900 }}>
                        <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: 12, paddingRight: 12 }}>TOTAL PENDING</td>
                        <td className="text-red bold" style={{ fontSize: 15 }}>PKR {totalPending.toLocaleString()}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Ledger Entries ── */}
        <div className="section-box">
          <div className="section-title" style={{ marginBottom: 12 }}>📒 Ledger Entries</div>
          {ledgerLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading entries...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 50, color: 'var(--text-muted)', fontSize: 13 }}>
              No ledger entries yet. Create an invoice, purchase, or day book entry linked to this account.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Ref</th>
                    <th>Type</th>
                    <th className="text-red">Debit (Dr)</th>
                    <th className="text-green">Credit (Cr)</th>
                    <th>Running Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((e, i) => (
                    <tr key={e._id || i}>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.date || e.createdAt?.slice(0, 10) || '—'}</td>
                      <td style={{ fontWeight: 500 }}>{e.description || '—'}</td>
                      <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--blue)' }}>{e.documentRef || '—'}</td>
                      <td>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--glass)', border: '1px solid var(--glass-border)', textTransform: 'capitalize' }}>
                          {e.documentType || 'manual'}
                        </span>
                      </td>
                      <td className="text-red bold">{e.debit  ? `PKR ${Number(e.debit ).toLocaleString()}` : '—'}</td>
                      <td className="text-green bold">{e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—'}</td>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', color: (e._runBal || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        PKR {Number(e._runBal || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {/* Totals footer */}
                  <tr style={{ background: 'rgba(255,255,255,0.04)', fontWeight: 900 }}>
                    <td colSpan={5} style={{ textAlign: 'right', paddingRight: 12, color: 'var(--text-muted)', fontSize: 12 }}>TOTALS</td>
                    <td className="text-red bold">PKR {totalDebit.toLocaleString()}</td>
                    <td className="text-green bold">PKR {totalCredit.toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 900, color: currentBalance >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      PKR {Number(currentBalance).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Supplier Purchases Summary ── */}
        {isSupplier && supplierPurchases.length > 0 && (
          <div className="section-box" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>🛒 Purchase Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }}>⚠️ AMOUNT OWED</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--amber)', margin: '4px 0' }}>PKR {totalOwedToSupp.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>payable to supplier</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700 }}>✅ AMOUNT PAID</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--green)', margin: '4px 0' }}>PKR {totalPaidToSupp.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>payments made</div>
              </div>
              <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}>📦 TOTAL PURCHASED</div>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: 'var(--blue)', margin: '4px 0' }}>PKR {totalPurchased.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{supplierPurchases.length} purchases</div>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Purchase #</th><th>Date</th><th>Total</th><th>Items</th></tr></thead>
                <tbody>
                  {[...supplierPurchases].sort((a,b) => new Date(b.date) - new Date(a.date)).map(p => (
                    <tr key={p.id}>
                      <td className="font-mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>{p.number}</td>
                      <td style={{ fontSize: 12 }}>{p.date}</td>
                      <td style={{ fontWeight: 700 }}>PKR {Number(p.totalAmount || 0).toLocaleString()}</td>
                      <td>{(p.items || []).length} item(s)</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editIDFor && (
          <EditAccountIDModal contact={editIDFor} onClose={() => setEditIDFor(null)}
            onSuccess={async () => { setEditIDFor(null); await reloadLedger() }} />
        )}
        {advanceFor && (
          <ReceiveAdvanceModal contact={advanceFor} onClose={() => setAdvanceFor(null)}
            onSuccess={async () => { setAdvanceFor(null); await reloadLedger() }} />
        )}
        {payInvoice && (
          <RecordPaymentModal
            invoice={payInvoice}
            contact={contact}
            onClose={() => setPayInvoice(null)}
            onSuccess={async () => { setPayInvoice(null); await reloadLedger() }}
          />
        )}
        {paySupplier && (
          <PaySupplierModal
            contact={paySupplier}
            onClose={() => setPaySupplier(null)}
            onSuccess={async () => { setPaySupplier(null); await reloadLedger() }}
          />
        )}
      </div>
    )
  }

  // ── Contacts List ─────────────────────────────────────────────────────────────
  const clientContacts   = contacts.filter(c => c.type === 'client')
  const supplierContacts = contacts.filter(c => c.type === 'supplier')
  const staffContacts    = contacts.filter(c => c.type === 'staff')

  // Totals from invoice data (most accurate for AR)
  const allInvoices = data.invoices || []
  const totalAR = allInvoices
    .filter(i => i.status !== 'paid' && i.status !== 'cancelled')
    .reduce((s, i) => s + Math.max((i.total || 0) - (i.advancePaid || 0), 0), 0)
  const totalAP = supplierContacts.reduce((s, c) => s + Math.abs(c.currentBalance || 0), 0)

  // Client-wise pending bill totals
  const clientMeta = clientContacts.reduce((acc, c) => {
    const invs    = allInvoices.filter(i =>
      i.accountHeadID
        ? i.accountHeadID === c.accountHeadID
        : i.clientName?.toLowerCase() === c.name?.toLowerCase()
    )
    const pending = invs.filter(i => i.status !== 'paid').reduce((s, i) => s + Math.max((i.total || 0) - (i.advancePaid || 0), 0), 0)
    acc[c.id] = pending
    return acc
  }, {})

  // Filter button config
  const FILTER_TABS = [
    { key: 'all',      label: 'All',       icon: '📗', color: 'var(--text)',   count: contacts.length },
    { key: 'client',   label: 'Clients',   icon: '🤝', color: 'var(--green)',  count: clientContacts.length,   value: `PKR ${totalAR.toLocaleString()}`,        sub: 'receivable' },
    { key: 'supplier', label: 'Suppliers', icon: '🏭', color: 'var(--amber)',  count: supplierContacts.length, value: `PKR ${totalAP.toLocaleString()}`,        sub: 'payable' },
    { key: 'staff',    label: 'Staff',     icon: '👷', color: 'var(--blue)',   count: staffContacts.length,    value: `${staffContacts.length} members`,        sub: 'employees' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📗 <span>Ledger</span></h2>
      </div>

      {/* ── Filter Tab Cards (clickable) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        {FILTER_TABS.map(tab => {
          const active = typeFilter === tab.key
          return (
            <div
              key={tab.key}
              onClick={() => setTypeFilter(tab.key)}
              style={{
                padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                background: active ? `${tab.color}22` : 'var(--glass)',
                border: `2px solid ${active ? tab.color : 'var(--glass-border)'}`,
                transition: 'all 0.18s',
                boxShadow: active ? `0 0 12px ${tab.color}33` : 'none',
              }}
            >
              <div style={{ fontSize: 11, color: tab.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                {tab.icon} {tab.label}
              </div>
              {tab.value && (
                <div style={{ fontSize: 17, fontWeight: 900, fontFamily: 'Orbitron, monospace', color: tab.color, margin: '2px 0' }}>
                  {tab.value}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tab.count} {tab.sub || 'total'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Search bar */}
      <div className="search-bar" style={{ marginBottom: 14 }}>
        <input className="input" style={{ maxWidth: 320 }} placeholder="🔍 Search by name or account ID..."
          value={search} onChange={e => setSearch(e.target.value)} />
        {search && (
          <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>✕ Clear</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          No contacts found. Add contacts in the Contacts module first.
        </div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Account ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Phone</th>
                <th>Opening Bal.</th>
                <th>Ledger Balance</th>
                <th className="text-red">Pending Bills</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const pending = clientMeta[c.id] || 0
                return (
                  <tr key={c._id || c.id}>
                    <td className="font-mono" style={{ fontSize: 12, fontWeight: 700, color: TYPE_COLORS[c.type] }}>
                      {c.accountHeadID}
                    </td>
                    <td style={{ fontWeight: 700 }}>{c.name}</td>
                    <td>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: 'var(--glass)', border: '1px solid var(--glass-border)', color: TYPE_COLORS[c.type] }}>
                        {TYPE_LABELS[c.type]}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>PKR {Number(c.openingBalance || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 700, color: (c.currentBalance || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                      PKR {Number(c.currentBalance || 0).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 700, color: pending > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                      {c.type === 'client' ? `PKR ${Number(pending).toLocaleString()}` : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => loadLedger(c)}
                          style={{ borderColor: TYPE_COLORS[c.type], color: TYPE_COLORS[c.type] }}>
                          📋 Ledger
                        </button>
                        <button className="btn btn-secondary btn-xs" onClick={() => setEditIDFor(c)}
                          style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}>
                          🔢 ID
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {editIDFor && (
        <EditAccountIDModal contact={editIDFor} onClose={() => setEditIDFor(null)}
          onSuccess={async (updated) => {
            setEditIDFor(null)
            setContacts(cs => cs.map(c => c.id === updated.id ? { ...c, accountHeadID: updated.accountHeadID } : c))
            await refreshData()
          }} />
      )}
    </div>
  )
}
