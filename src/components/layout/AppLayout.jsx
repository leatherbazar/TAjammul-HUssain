import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'

const ADMIN_NAV = [
  { section: 'Overview' },
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/calendar', label: 'Calendar', icon: '📅' },
  { section: 'Documents' },
  { path: '/admin/quotations', label: 'Quotations', icon: '📋' },
  { path: '/admin/supply-orders', label: 'Supply Orders', icon: '🛒' },
  { path: '/admin/delivery-notes', label: 'Delivery Notes', icon: '🚚' },
  { path: '/admin/invoices', label: 'Invoices', icon: '🧾' },
  { section: 'Business' },
  { path: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { path: '/admin/finance', label: 'Finance / Day Book', icon: '💰' },
  { path: '/admin/clients', label: 'Client Requests', icon: '🤝' },
  { section: 'Administration' },
  { path: '/admin/users', label: 'User Management', icon: '👥' },
  { path: '/admin/settings', label: 'Settings', icon: '⚙️' },
]

const EMPLOYEE_NAV = [
  { section: 'My Work' },
  { path: '/employee', label: 'Dashboard', icon: '📊' },
  { path: '/employee/supply-orders', label: 'Supply Orders', icon: '🛒' },
  { path: '/employee/inventory', label: 'Inventory Update', icon: '📦' },
]

const CLIENT_NAV = [
  { section: 'My Portal' },
  { path: '/client', label: 'Dashboard', icon: '📊' },
  { path: '/client/requests', label: 'My Requests', icon: '📋' },
  { path: '/client/new-request', label: '+ New Request', icon: '➕' },
  { path: '/client/documents', label: 'My Documents', icon: '📄' },
]

function Marquee() {
  return (
    <div className="marquee-bar no-print">
      <div className="marquee-inner">
        &nbsp;&nbsp;&nbsp;✦ Welcome to Tataheer Business Group — Your Trusted Partner in Quality Garments & Trade ✦&nbsp;&nbsp;&nbsp;
        426- Ali Arcade, 13-km Main Multan Road, Lahore &nbsp;|&nbsp; +92(314)4094900 &nbsp;|&nbsp; tataheertraders@gmail.com &nbsp;&nbsp;&nbsp;
        ✦ All transactions are secure and encrypted ✦&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
      </div>
    </div>
  )
}

function Navbar({ user, onLogout, onToggleSidebar }) {
  return (
    <div className="navbar no-print">
      <button
        className="btn btn-secondary btn-sm"
        onClick={onToggleSidebar}
        style={{ padding: '6px 10px' }}
        title="Toggle sidebar"
      >☰</button>

      <div className="navbar-logo">
        <img
          src="/logo.png"
          alt="TAT"
          className="logo-img"
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
        <div className="logo-badge" style={{ display: 'none' }}>TAT</div>
        <div className="logo-text">
          <h1>TATAHEER TRADERS</h1>
          <p>Enterprise Resource Planning 2026</p>
        </div>
      </div>

      <div className="navbar-spacer" />

      <div className="navbar-user">
        <span style={{ fontSize: 18 }}>{user?.role === 'admin' ? '🛡️' : user?.role === 'employee' ? '👷' : '🤝'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.username}</div>
        </div>
        <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
      </div>

      <button className="btn btn-danger btn-sm" onClick={onLogout}>Logout</button>
    </div>
  )
}

function Sidebar({ navItems, location, onNavigate, visible }) {
  return (
    <div className="sidebar no-print" style={{ display: visible ? 'flex' : 'none', width: visible ? 'var(--sidebar-w)' : 0 }}>
      {navItems.map((item, i) => {
        if (item.section) return (
          <div key={i} className="sidebar-section">{item.section}</div>
        )
        const isActive = location.pathname === item.path || (item.path !== '/admin' && item.path !== '/employee' && item.path !== '/client' && location.pathname.startsWith(item.path))
        return (
          <button
            key={i}
            className={`nav-link ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(item.path)}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export default function AppLayout({ children }) {
  const { currentUser, setCurrentUser } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarVisible, setSidebarVisible] = useState(true)

  const handleLogout = () => {
    setCurrentUser(null)
    toast.success('Logged out successfully.')
    navigate('/')
  }

  const navItems = currentUser?.role === 'admin' ? ADMIN_NAV
    : currentUser?.role === 'employee' ? EMPLOYEE_NAV
    : CLIENT_NAV

  return (
    <>
      <Marquee />
      <Navbar user={currentUser} onLogout={handleLogout} onToggleSidebar={() => setSidebarVisible(v => !v)} />
      <div className="app-layout">
        <Sidebar navItems={navItems} location={location} onNavigate={navigate} visible={sidebarVisible} />
        <div className="main-content fade-in">
          {children}
        </div>
      </div>
    </>
  )
}
