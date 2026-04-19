import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useApp } from './context/AppContext'
import AppLayout from './components/layout/AppLayout'
import Login from './components/Login'
import Dashboard from './components/modules/Dashboard'
import Quotations from './components/modules/Quotation'
import SupplyOrders from './components/modules/SupplyOrder'
import Invoices from './components/modules/Invoice'
import DeliveryNotes from './components/modules/DeliveryNote'
import Inventory from './components/modules/Inventory'
import Finance from './components/modules/Finance'
import CalendarModule from './components/modules/CalendarModule'
import UserManagement from './components/modules/UserManagement'
import Settings from './components/modules/Settings'
import ClientPortal from './components/modules/ClientPortal'
import Contacts from './components/modules/Contacts'
import Ledger from './components/modules/Ledger'
import Purchases from './components/modules/Purchase'
import Sales from './components/modules/Sales'

function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser } = useApp()
  if (!currentUser) return <Navigate to="/" replace />
  if (allowedRoles && !allowedRoles.includes(currentUser.role)) return <Navigate to="/" replace />
  return children
}

function AdminRoutes() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AppLayout>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarModule />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="supply-orders" element={<SupplyOrders />} />
          <Route path="delivery-notes" element={<DeliveryNotes />} />
          <Route path="invoices" element={<Invoices />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="finance" element={<Finance />} />
          <Route path="clients" element={<ClientRequestsAdmin />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="sales" element={<Sales />} />
          <Route path="users" element={<UserManagement />} />
          <Route path="settings" element={<Settings />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  )
}

function EmployeeRoutes() {
  return (
    <ProtectedRoute allowedRoles={['employee']}>
      <AppLayout>
        <Routes>
          <Route index element={<EmployeeDashboard />} />
          <Route path="supply-orders" element={<SupplyOrders isEmployee />} />
          <Route path="quotations" element={<Quotations isEmployee />} />
          <Route path="inventory" element={<Inventory isEmployee />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  )
}

function ClientRoutes() {
  return (
    <ProtectedRoute allowedRoles={['client']}>
      <AppLayout>
        <Routes>
          <Route index element={<ClientPortal />} />
          <Route path="requests" element={<ClientPortal />} />
          <Route path="new-request" element={<ClientPortal />} />
          <Route path="documents" element={<ClientPortal />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  )
}

// Employee Dashboard
function EmployeeDashboard() {
  const { data, currentUser } = useApp()
  const myOrders = (data.supplyOrders || []).filter(o => o.assignedTo === currentUser?.id)
  const pendingOrders = myOrders.filter(o => o.status === 'pending' || o.status === 'in-progress')

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>📊 <span>Employee Dashboard</span></h2>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Welcome, <strong style={{ color: 'var(--blue)' }}>{currentUser?.name}</strong>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card card-blue"><div className="label">📋 My Orders</div><div className="value" style={{ fontSize: 28 }}>{myOrders.length}</div></div>
        <div className="stat-card card-amber"><div className="label">⏳ Pending</div><div className="value" style={{ fontSize: 28 }}>{pendingOrders.length}</div></div>
        <div className="stat-card card-green"><div className="label">✅ Completed</div><div className="value" style={{ fontSize: 28 }}>{myOrders.filter(o => o.status === 'sourced' || o.status === 'delivered').length}</div></div>
      </div>

      <div className="section-box">
        <div className="section-title">⏳ My Pending Orders</div>
        {pendingOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No pending orders assigned to you.</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Title</th><th>Items</th><th>Priority</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {pendingOrders.map(o => (
                  <tr key={o.id}>
                    <td className="font-mono" style={{ fontSize: 12 }}>{o.number}</td>
                    <td style={{ fontWeight: 600 }}>{o.title}</td>
                    <td>{(o.items || []).length}</td>
                    <td style={{ color: o.priority === 'urgent' ? 'var(--red)' : o.priority === 'high' ? 'var(--amber)' : 'var(--text-muted)', fontWeight: 700, fontSize: 12, textTransform: 'capitalize' }}>{o.priority}</td>
                    <td style={{ fontSize: 12 }}>{o.date}</td>
                    <td><span className={`badge badge-${o.status === 'in-progress' ? 'pending' : o.status}`}>{o.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// Send Quote modal — admin creates a quotation and sends to a client
function SendQuoteModal({ clients, onClose, onSend }) {
  const [form, setForm] = React.useState({
    clientName: clients[0]?.name || '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
    items: [{ id: Date.now(), description: '', qty: 1, unitPrice: 0 }],
  })

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { id: Date.now(), description: '', qty: 1, unitPrice: 0 }] }))
  const removeItem = (id) => setForm(f => ({ ...f, items: f.items.filter(i => i.id !== id) }))
  const updateItem = (id, k, v) => setForm(f => ({ ...f, items: f.items.map(i => i.id === id ? { ...i, [k]: v } : i) }))

  const total = form.items.reduce((s, i) => s + (parseInt(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)

  const handleSend = () => {
    if (!form.clientName) { alert('Please select a client.'); return }
    if (!form.items.some(i => i.description)) { alert('Add at least one item description.'); return }
    const client = clients.find(c => c.name === form.clientName)
    onSend({ ...form, total, clientId: client?.id, source: 'admin', status: 'sent' })
  }

  const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }
  const boxStyle = { background: 'var(--card-bg)', border: '1px solid var(--glass-border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }

  // Guard: no clients registered yet
  if (clients.length === 0) {
    return (
      <div style={overlayStyle} onClick={onClose}>
        <div style={{ ...boxStyle, textAlign: 'center', padding: 40 }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>👤</div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>No clients registered</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>Add client accounts in User Management first before sending a quote.</div>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={boxStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>📤 Send Quote to Client</h3>
          <button className="btn btn-secondary btn-xs" onClick={onClose}>✕</button>
        </div>

        <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
          <div className="input-group">
            <label className="input-label">Client *</label>
            <select className="input" value={form.clientName} onChange={e => setField('clientName', e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
        </div>

        {form.items.map((item, idx) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px auto', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
            <div className="input-group" style={{ margin: 0 }}>
              {idx === 0 && <label className="input-label">Item Description</label>}
              <input className="input" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Item name..." />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              {idx === 0 && <label className="input-label">Qty</label>}
              <input type="number" className="input" min="1" value={item.qty} onChange={e => updateItem(item.id, 'qty', e.target.value)} />
            </div>
            <div className="input-group" style={{ margin: 0 }}>
              {idx === 0 && <label className="input-label">Unit Price</label>}
              <input type="number" className="input" min="0" value={item.unitPrice} onChange={e => updateItem(item.id, 'unitPrice', e.target.value)} />
            </div>
            <button className="btn btn-danger btn-xs" onClick={() => removeItem(item.id)} style={{ marginBottom: 0 }} disabled={form.items.length === 1}>✕</button>
          </div>
        ))}
        <button className="btn btn-secondary btn-sm" onClick={addItem} style={{ marginBottom: 14 }}>+ Add Item</button>

        <div style={{ textAlign: 'right', fontSize: 16, fontWeight: 800, color: 'var(--green)', marginBottom: 12 }}>
          Total: PKR {total.toLocaleString()}
        </div>

        <div className="input-group" style={{ marginBottom: 16 }}>
          <label className="input-label">Notes (optional)</label>
          <textarea className="input" rows={2} value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Terms, delivery info..." />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSend}>📤 Send Quote</button>
        </div>
      </div>
    </div>
  )
}

// Admin view of client requests
function ClientRequestsAdmin() {
  const { data, updateRecord, addRecord, refreshData } = useApp()
  const [refreshing, setRefreshing] = React.useState(false)
  const [showSendQuote, setShowSendQuote] = React.useState(false)
  const requests = (data.quotations || []).filter(q => q.source === 'client' || q.source === 'admin')
  const clientList = data.users?.clients || []

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()
    setRefreshing(false)
  }

  const handleSendQuote = (formData) => {
    const num = `QUO-${Date.now().toString().slice(-5)}`
    addRecord('quotations', { ...formData, number: num })
    setShowSendQuote(false)
  }

  return (
    <div className="fade-in">
      {showSendQuote && (
        <SendQuoteModal
          clients={clientList}
          onClose={() => setShowSendQuote(false)}
          onSend={handleSendQuote}
        />
      )}
      <div className="page-header">
        <h2>🤝 <span>Client Requests</span></h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowSendQuote(true)}>📤 Send Quote</button>
          <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No client requests yet.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Type</th><th>Client</th><th>Date</th><th>Items</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {[...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(q => (
                <tr key={q.id}>
                  <td className="font-mono" style={{ fontSize: 12 }}>{q.number}</td>
                  <td>
                    {q.source === 'admin'
                      ? <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--blue)', fontWeight: 700 }}>📩 Sent</span>
                      : <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>📋 Request</span>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{q.clientName}</td>
                  <td style={{ fontSize: 12 }}>{q.date}</td>
                  <td>{(q.items || []).length}</td>
                  <td className="text-green bold">PKR {Number(q.total || 0).toLocaleString()}</td>
                  <td><span className={`badge badge-${q.status}`}>{q.status === 'cancelled' ? 'Rejected' : q.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {q.source !== 'admin' && (
                        <>
                          <button
                            className="btn btn-success btn-xs"
                            onClick={() => updateRecord('quotations', q.id, { status: 'approved' })}
                            disabled={q.status === 'approved' || q.status === 'cancelled'}
                            style={{ opacity: (q.status === 'approved' || q.status === 'cancelled') ? 0.4 : 1 }}
                          >✅ Approve</button>
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => updateRecord('quotations', q.id, { status: 'cancelled' })}
                            disabled={q.status === 'approved' || q.status === 'cancelled'}
                            style={{ opacity: (q.status === 'approved' || q.status === 'cancelled') ? 0.4 : 1 }}
                          >✕ Reject</button>
                        </>
                      )}
                    </div>
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

export default function App() {
  const { currentUser } = useApp()

  return (
    <Routes>
      <Route path="/" element={
        currentUser ? <Navigate to={`/${currentUser.role}`} replace /> : <Login />
      } />
      <Route path="/admin/*" element={<AdminRoutes />} />
      <Route path="/employee/*" element={<EmployeeRoutes />} />
      <Route path="/client/*" element={<ClientRoutes />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
