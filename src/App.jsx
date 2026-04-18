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

// Admin view of client requests
function ClientRequestsAdmin() {
  const { data, updateRecord } = useApp()
  const requests = (data.quotations || []).filter(q => q.source === 'client')

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>🤝 <span>Client Requests</span></h2>
      </div>
      {requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No pending client requests.</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead><tr><th>#</th><th>Client</th><th>Date</th><th>Items</th><th>Target Value</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {[...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(q => (
                <tr key={q.id}>
                  <td className="font-mono" style={{ fontSize: 12 }}>{q.number}</td>
                  <td style={{ fontWeight: 600 }}>{q.clientName}</td>
                  <td style={{ fontSize: 12 }}>{q.date}</td>
                  <td>{(q.items || []).length}</td>
                  <td className="text-green bold">PKR {Number(q.total || 0).toLocaleString()}</td>
                  <td><span className={`badge badge-${q.status}`}>{q.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-success btn-xs" onClick={() => updateRecord('quotations', q.id, { status: 'approved' })}>✅ Approve</button>
                      <button className="btn btn-danger btn-xs" onClick={() => updateRecord('quotations', q.id, { status: 'cancelled' })}>✕ Reject</button>
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
