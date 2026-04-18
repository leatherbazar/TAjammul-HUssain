import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

const TYPE_COLORS = {
  client: 'var(--green)',
  supplier: 'var(--amber)',
  staff: 'var(--blue)',
}

const TYPE_LABELS = {
  client: '🤝 Client',
  supplier: '🏭 Supplier',
  staff: '👷 Staff',
}

export default function Ledger() {
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState(null)  // { contact, entries }
  const [loading, setLoading] = useState(false)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')

  const loadContacts = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/contacts')
      const data = await res.json()
      setContacts(data.contacts || [])
    } catch {
      toast.error('Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadContacts() }, [])

  const loadLedger = async (contact) => {
    setLedgerLoading(true)
    try {
      const res = await fetch(`/api/ledger/${contact.accountHeadID}`)
      const data = await res.json()
      setSelected({ contact, entries: data.entries || [] })
    } catch {
      toast.error('Failed to load ledger')
    } finally {
      setLedgerLoading(false)
    }
  }

  const filtered = contacts.filter(c => {
    const matchType = typeFilter === 'all' || c.type === typeFilter
    const matchSearch = !search ||
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      c.accountHeadID?.toLowerCase().includes(search.toLowerCase()) ||
      c.phone?.includes(search)
    return matchType && matchSearch
  })

  if (selected) {
    const { contact, entries } = selected
    const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0)
    const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0)
    const currentBalance = contact.currentBalance || 0

    return (
      <div className="fade-in">
        <div className="page-header">
          <h2>📗 <span>Account Statement</span></h2>
          <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>← Back to Ledger</button>
        </div>

        {/* Contact Header */}
        <div className="section-box" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: TYPE_COLORS[contact.type], fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                {TYPE_LABELS[contact.type]}
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>{contact.name}</div>
              <div style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 4 }}>{contact.accountHeadID}</div>
              {contact.phone && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{contact.phone}</div>}
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                ['Total Debit', totalDebit, 'var(--red)'],
                ['Total Credit', totalCredit, 'var(--green)'],
                ['Current Balance', currentBalance, currentBalance >= 0 ? 'var(--green)' : 'var(--red)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{
                  padding: '12px 18px', borderRadius: 10,
                  background: 'var(--glass)', border: '1px solid var(--glass-border)',
                  textAlign: 'center', minWidth: 140
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: 'Orbitron, sans-serif' }}>
                    PKR {Number(val).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Entries Table */}
        {ledgerLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading entries...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            No ledger entries for this account yet.
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Document Ref</th>
                  <th>Type</th>
                  <th className="text-red">Debit (Dr)</th>
                  <th className="text-green">Credit (Cr)</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e._id || i}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{e.date || e.createdAt?.slice(0, 10) || '—'}</td>
                    <td style={{ fontWeight: 500 }}>{e.description || '—'}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--blue)' }}>{e.documentRef || '—'}</td>
                    <td>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'var(--glass)', border: '1px solid var(--glass-border)', textTransform: 'capitalize' }}>
                        {e.documentType || 'manual'}
                      </span>
                    </td>
                    <td className="text-red bold">{e.debit ? `PKR ${Number(e.debit).toLocaleString()}` : '—'}</td>
                    <td className="text-green bold">{e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—'}</td>
                    <td style={{ fontWeight: 700, color: (e.balance || 0) >= 0 ? 'var(--green)' : 'var(--red)', fontFamily: 'monospace' }}>
                      PKR {Number(e.balance || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  // Contacts list view
  const totalOutstanding = contacts.filter(c => c.type === 'client').reduce((s, c) => s + (c.currentBalance || 0), 0)
  const totalPayable = contacts.filter(c => c.type === 'supplier').reduce((s, c) => s + (c.currentBalance || 0), 0)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📗 <span>Ledger</span></h2>
      </div>

      {/* Summary */}
      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
        <div className="stat-card card-green">
          <div className="label">🤝 Receivable (Clients)</div>
          <div className="value" style={{ fontSize: 18 }}>PKR {totalOutstanding.toLocaleString()}</div>
          <div className="sub">{contacts.filter(c => c.type === 'client').length} clients</div>
        </div>
        <div className="stat-card card-amber">
          <div className="label">🏭 Payable (Suppliers)</div>
          <div className="value" style={{ fontSize: 18 }}>PKR {totalPayable.toLocaleString()}</div>
          <div className="sub">{contacts.filter(c => c.type === 'supplier').length} suppliers</div>
        </div>
        <div className="stat-card card-blue">
          <div className="label">👷 Staff Accounts</div>
          <div className="value" style={{ fontSize: 18 }}>{contacts.filter(c => c.type === 'staff').length}</div>
          <div className="sub">staff members</div>
        </div>
      </div>

      {/* Filters */}
      <div className="search-bar" style={{ marginBottom: 16 }}>
        <input
          className="input" style={{ maxWidth: 280 }}
          placeholder="🔍 Search by name or account ID..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="input" style={{ maxWidth: 160 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="client">Clients</option>
          <option value="supplier">Suppliers</option>
          <option value="staff">Staff</option>
        </select>
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
                <th>Current Balance</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c._id}>
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
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    PKR {Number(c.openingBalance || 0).toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 700, color: (c.currentBalance || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    PKR {Number(c.currentBalance || 0).toLocaleString()}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-xs"
                      onClick={() => loadLedger(c)}
                      style={{ borderColor: TYPE_COLORS[c.type], color: TYPE_COLORS[c.type] }}
                    >
                      📋 View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
