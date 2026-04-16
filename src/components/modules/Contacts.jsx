import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import MasterCodeModal from '../common/MasterCodeModal'
import toast from 'react-hot-toast'

const TYPES = [
  { key: 'supplier', label: '🏭 Suppliers', color: 'var(--amber)' },
  { key: 'client',   label: '🤝 Clients',   color: 'var(--green)' },
  { key: 'staff',    label: '👷 Staff',      color: 'var(--blue)' },
]

const EMPTY_FORM = {
  type: 'supplier', name: '', phone: '', email: '',
  address: '', notes: '', openingBalance: 0, accountCode: ''
}

export default function Contacts() {
  const { data, addRecord, updateRecord, deleteRecord, verifyMasterCode } = useApp()
  const contacts = data.contacts || []

  const [activeTab, setActiveTab] = useState('supplier')
  const [view, setView] = useState('list')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [search, setSearch] = useState('')
  const [mcModal, setMcModal] = useState({ open: false, action: null })

  const filtered = contacts.filter(c =>
    c.type === activeTab &&
    (c.name?.toLowerCase().includes(search.toLowerCase()) ||
     c.phone?.includes(search) ||
     c.accountCode?.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (editId) {
      updateRecord('contacts', editId, { ...form })
      toast.success('Contact updated!')
    } else {
      addRecord('contacts', { ...form })
      toast.success('Contact added!')
    }
    setView('list')
    setForm(EMPTY_FORM)
    setEditId(null)
  }

  const handleEdit = (c) => {
    setMcModal({
      open: true, action: () => {
        setForm({ ...EMPTY_FORM, ...c })
        setEditId(c.id)
        setView('form')
      }
    })
  }

  const handleDelete = (id) => {
    setMcModal({
      open: true, action: () => {
        deleteRecord('contacts', id)
        toast.success('Contact deleted')
      }
    })
  }

  const activeType = TYPES.find(t => t.key === activeTab)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📒 <span>Contacts & Accounts</span></h2>
        {view === 'list' && (
          <button className="btn btn-primary" onClick={() => {
            setForm({ ...EMPTY_FORM, type: activeTab })
            setEditId(null)
            setView('form')
          }}>+ Add {activeType?.label.split(' ')[1]}</button>
        )}
        {view === 'form' && (
          <button className="btn btn-secondary" onClick={() => { setView('list'); setForm(EMPTY_FORM); setEditId(null) }}>← Back</button>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {TYPES.map(t => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(t.key); setView('list'); setSearch('') }}
            style={activeTab === t.key ? { borderColor: t.color, color: t.color } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === 'list' && (
        <>
          {/* Search */}
          <div style={{ marginBottom: 16 }}>
            <input
              className="input"
              placeholder={`Search ${activeType?.label}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ maxWidth: 340 }}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
              No {activeType?.label.toLowerCase()} yet. Click "+ Add" to create one.
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                    <th>Address</th>
                    <th>Opening Bal.</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id}>
                      <td className="font-mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.accountCode || '—'}</td>
                      <td style={{ fontWeight: 700, color: activeType.color }}>{c.name}</td>
                      <td>{c.phone || '—'}</td>
                      <td style={{ fontSize: 12 }}>{c.email || '—'}</td>
                      <td style={{ fontSize: 12, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address || '—'}</td>
                      <td style={{ color: 'var(--green)', fontWeight: 700 }}>
                        {Number(c.openingBalance || 0).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-xs" onClick={() => handleEdit(c)}>✏️</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(c.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {view === 'form' && (
        <div className="section-box" style={{ maxWidth: 600 }}>
          <div className="section-title" style={{ marginBottom: 20 }}>
            {editId ? '✏️ Edit Contact' : `➕ New ${activeType?.label.split(' ')[1]}`}
          </div>
          <form onSubmit={handleSave}>
            <div className="form-grid-2">
              <div className="input-group">
                <label className="input-label">Type</label>
                <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Account Code (optional)</label>
                <input className="input" placeholder="e.g. SUP-001, CLI-I2C" value={form.accountCode} onChange={e => setForm(f => ({ ...f, accountCode: e.target.value }))} />
              </div>
              <div className="input-group col-span-2">
                <label className="input-label">Full Name *</label>
                <input className="input" placeholder="Contact / Company name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="input-group">
                <label className="input-label">Phone</label>
                <input className="input" placeholder="+92..." value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Email</label>
                <input className="input" type="email" placeholder="email@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="input-group col-span-2">
                <label className="input-label">Address</label>
                <input className="input" placeholder="Street, City" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Opening Balance (PKR)</label>
                <input className="input" type="number" min="0" value={form.openingBalance} onChange={e => setForm(f => ({ ...f, openingBalance: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Notes</label>
                <input className="input" placeholder="Any notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="form-actions" style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button type="submit" className="btn btn-primary">💾 Save Contact</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setView('list'); setForm(EMPTY_FORM); setEditId(null) }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {mcModal.open && (
        <MasterCodeModal
          onVerify={() => { setMcModal({ open: false, action: null }); mcModal.action?.() }}
          onClose={() => setMcModal({ open: false, action: null })}
        />
      )}
    </div>
  )
}
