import React, { useState, useEffect } from 'react'
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
  { section: 'Stock & Accounts' },
  { path: '/admin/purchases', label: 'Purchases (Stock In)', icon: '🏭' },
  { path: '/admin/sales', label: 'Sales (Stock Out)', icon: '🛍️' },
  { path: '/admin/inventory', label: 'Inventory', icon: '📦' },
  { section: 'Finance' },
  { path: '/admin/contacts', label: 'Contacts', icon: '📒' },
  { path: '/admin/ledger', label: 'Ledger', icon: '📗' },
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
  { path: '/employee/quotations', label: 'Quotations', icon: '📋' },
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
      {/* Hamburger button — always visible, toggles sidebar */}
      <button
        className="btn btn-secondary btn-sm hamburger-btn"
        onClick={onToggleSidebar}
        style={{ padding: '6px 10px', flexShrink: 0 }}
        title="Toggle sidebar"
        aria-label="Toggle navigation"
      >
        ☰
      </button>

      <div className="navbar-logo">
        <img
          src="/logo-tat.png"
          alt="TAT"
          className="logo-img"
          style={{ height: 44, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}
        />
        <img
          src="/tataheer-logo.png"
          alt="Tataheer Traders"
          style={{ height: 28, objectFit: 'contain', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6)) brightness(1.15)' }}
          className="navbar-brand-text"
        />
      </div>

      <div className="navbar-spacer" />

      <div className="navbar-user">
        <span style={{ fontSize: 18 }}>
          {user?.role === 'admin' ? '🛡️' : user?.role === 'employee' ? '👷' : '🤝'}
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{user?.username}</div>
        </div>
        <span className={`role-badge role-${user?.role}`}>{user?.role}</span>
      </div>

      <button className="btn btn-danger btn-sm" onClick={() => onLogout(false)}>Logout</button>
    </div>
  )
}

function Sidebar({ navItems, location, onNavigate, sidebarOpen, onClose, user, onLogout }) {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled]     = useState(false)
  const [showGuide, setShowGuide]         = useState(false)

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true)
    window.addEventListener('appinstalled', () => { setIsInstalled(true); setInstallPrompt(null) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (installPrompt) {
      // Chrome Android/Desktop — native prompt
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') { setInstallPrompt(null); setIsInstalled(true) }
    } else {
      // iOS Safari or already dismissed — show manual guide
      setShowGuide(true)
    }
  }

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

  return (
    <>
      {/* Overlay — shown on mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay no-print"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <div className={`sidebar no-print${sidebarOpen ? ' sidebar-open' : ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Nav Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map((item, i) => {
            if (item.section) return (
              <div key={i} className="sidebar-section">{item.section}</div>
            )
            const isActive =
              location.pathname === item.path ||
              (
                item.path !== '/admin' &&
                item.path !== '/employee' &&
                item.path !== '/client' &&
                location.pathname.startsWith(item.path)
              )
            return (
              <button
                key={i}
                className={`nav-link ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(item.path)
                  onClose()
                }}
              >
                <span className="icon">{item.icon}</span>
                {item.label}
              </button>
            )
          })}
        </div>

        {/* ── Bottom: Install + User ─────────────────────────────── */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 8 }}>

          {/* Install Guide Modal */}
          {showGuide && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div className="glass" style={{ padding: 24, maxWidth: 340, width: '100%', borderRadius: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, textAlign: 'center' }}>📲 Install TAT ERP</div>
                {isIOS ? (
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>iOS (Safari):</div>
                    <div>1. Tap <strong>Share</strong> button (□↑) at bottom</div>
                    <div>2. Scroll down → tap <strong>"Add to Home Screen"</strong></div>
                    <div>3. Tap <strong>"Add"</strong> — done! ✅</div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Chrome (Desktop/Android):</div>
                    <div>1. Look for <strong>install icon (⊕)</strong> in address bar</div>
                    <div>2. Or tap <strong>3 dots menu (⋮)</strong></div>
                    <div>3. Tap <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong></div>
                    <div style={{ marginTop: 10, padding: '8px', borderRadius: 8, background: 'rgba(59,130,246,0.1)', fontSize: 12 }}>
                      💡 Make sure you're on <strong>tat-bbc9.onrender.com</strong> (HTTPS)
                    </div>
                  </div>
                )}
                <button onClick={() => setShowGuide(false)}
                  style={{ marginTop: 16, width: '100%', padding: '10px', borderRadius: 10, background: 'var(--red)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Install App Button — always visible unless installed */}
          {isInstalled ? (
            <div style={{ textAlign: 'center', fontSize: 11, color: '#22c55e', marginBottom: 8, padding: '6px 0' }}>
              ✅ App Installed
            </div>
          ) : (
            <button
              onClick={handleInstall}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 14px', marginBottom: 10,
                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <span style={{ fontSize: 16 }}>📲</span> Install App
            </button>
          )}

          {/* User Info + Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: user?.role === 'admin' ? 'var(--red)' : user?.role === 'employee' ? 'var(--blue)' : 'var(--green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
            <button
              onClick={onLogout}
              style={{
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', borderRadius: 6, padding: '3px 8px',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0
              }}
            >
              ↑ Out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export default function AppLayout({ children }) {
  const { currentUser, setCurrentUser, data } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = (auto = false) => {
    setCurrentUser(null)
    // Log logout to audit
    if (currentUser) {
      fetch('/api/audit-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: currentUser.name, userRole: currentUser.role, action: 'logout', detail: auto ? 'Auto-logout due to inactivity' : 'Manual logout' }) }).catch(() => {})
    }
    toast.success(auto ? 'Auto-logged out due to inactivity.' : 'Logged out successfully.')
    navigate('/')
  }

  // ── Auto Logout (session timeout) ────────────────────────────────────────────
  useEffect(() => {
    const timeoutMins = data?.securitySettings?.sessionTimeout || 30
    const timeoutMs = timeoutMins * 60 * 1000
    let timer
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => handleLogout(true), timeoutMs)
    }
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [data?.securitySettings?.sessionTimeout])

  // Close sidebar on route change (covers back-button navigation)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const navItems = currentUser?.role === 'admin' ? ADMIN_NAV
    : currentUser?.role === 'employee' ? EMPLOYEE_NAV
    : CLIENT_NAV

  return (
    <>
      <Marquee />
      <Navbar
        user={currentUser}
        onLogout={(auto) => handleLogout(auto)}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
      />
      <div className="app-layout">
        <Sidebar
          navItems={navItems}
          location={location}
          onNavigate={navigate}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          user={currentUser}
          onLogout={() => handleLogout(false)}
        />
        <div className="main-content fade-in">
          {children}
        </div>
      </div>
    </>
  )
}
