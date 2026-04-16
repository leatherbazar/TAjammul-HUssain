import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import toast from 'react-hot-toast'

const PORTALS = [
  { key: 'admin', label: '🛡️ Admin', color: 'var(--red)' },
  { key: 'employee', label: '👷 Employee', color: 'var(--blue)' },
  { key: 'client', label: '🤝 Client', color: 'var(--green)' },
]

export default function Login() {
  const { data, setCurrentUser } = useApp()
  const navigate = useNavigate()
  const [portal, setPortal] = useState('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showReg, setShowReg] = useState(false)
  const [regForm, setRegForm] = useState({ name: '', username: '', password: '', company: '', phone: '' })

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))

    if (portal === 'admin') {
      const admin = data.users.admin
      if (username === admin.username && password === admin.password) {
        setCurrentUser({ ...admin, role: 'admin' })
        toast.success(`Welcome, ${admin.name}!`)
        navigate('/admin')
      } else {
        toast.error('Invalid admin credentials.')
      }
    } else if (portal === 'employee') {
      const emp = data.users.employees.find(e => e.username === username && e.password === password && e.active)
      if (emp) {
        setCurrentUser({ ...emp, role: 'employee' })
        toast.success(`Welcome, ${emp.name}!`)
        navigate('/employee')
      } else {
        toast.error('Invalid credentials or account disabled.')
      }
    } else {
      const client = data.users.clients.find(c => c.username === username && c.password === password)
      if (client) {
        setCurrentUser({ ...client, role: 'client' })
        toast.success(`Welcome, ${client.name}!`)
        navigate('/client')
      } else {
        toast.error('Invalid credentials. Register if you are new.')
      }
    }
    setLoading(false)
  }

  const handleClientRegister = (e) => {
    e.preventDefault()
    if (data.users.clients.find(c => c.username === regForm.username)) {
      toast.error('Username already exists.')
      return
    }
    const newClient = { id: Date.now().toString(), ...regForm, role: 'client', createdAt: new Date().toISOString() }
    const updated = { ...data.users, clients: [...data.users.clients, newClient] }
    // We need to update via context — but Login doesn't have updateNested directly
    // Use update directly
    setCurrentUser(null)
    toast.success('Account created! Please login.')
    setShowReg(false)
    setUsername(regForm.username)
    setPassword(regForm.password)
    // Store via a quick trick — dispatch storage event
    const stored = JSON.parse(localStorage.getItem('tataheer_erp_v1') || '{}')
    stored.users = updated
    localStorage.setItem('tataheer_erp_v1', JSON.stringify(stored))
    window.location.reload()
  }

  return (
    <div className="login-page">
      {/* Logo / Header */}
      <div className="login-header fade-in">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img
            src="/logo-tat.png"
            alt="TAT Logo"
            style={{ height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }}
          />
          <img
            src="/tataheer-logo.png"
            alt="Tataheer Traders"
            style={{ height: 38, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6)) brightness(1.1)' }}
          />
        </div>
        <p style={{ marginTop: 6 }}>Enterprise Resource Planning System — 2026 Edition</p>
      </div>

      {/* Portal Selector */}
      <div style={{ width: '100%', maxWidth: 420, marginBottom: 0 }} className="fade-in">
        <div className="portal-selector">
          {PORTALS.map(p => (
            <button
              key={p.key}
              className={`portal-btn ${portal === p.key ? 'active' : ''}`}
              onClick={() => { setPortal(p.key); setUsername(''); setPassword('') }}
              style={portal === p.key ? { borderColor: p.color, color: p.color, background: `${p.color}22` } : {}}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Login Card */}
        <div className="glass" style={{ padding: 28 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, textAlign: 'center' }}>
            {portal === 'admin' && '🛡️ Administrator Login'}
            {portal === 'employee' && '👷 Employee Login'}
            {portal === 'client' && '🤝 Client Portal'}
          </h3>

          {!showReg ? (
            <form onSubmit={handleLogin}>
              <div className="input-group" style={{ marginBottom: 14 }}>
                <label className="input-label">Username</label>
                <input
                  className="input"
                  placeholder={portal === 'admin' ? 'admin' : 'Enter username'}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <span className="spin" style={{ display: 'inline-block' }}>◌</span> : null}
                {loading ? ' Verifying...' : 'Sign In'}
              </button>

              {portal === 'client' && (
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowReg(true)}>
                    New Client? Register Here
                  </button>
                </div>
              )}
            </form>
          ) : (
            <form onSubmit={handleClientRegister}>
              <div className="form-grid">
                <div className="input-group">
                  <label className="input-label">Full Name</label>
                  <input className="input" placeholder="Your name" value={regForm.name} onChange={e => setRegForm(f => ({ ...f, name: e.target.value }))} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Company</label>
                  <input className="input" placeholder="Company name" value={regForm.company} onChange={e => setRegForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Username</label>
                  <input className="input" placeholder="Choose username" value={regForm.username} onChange={e => setRegForm(f => ({ ...f, username: e.target.value }))} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone</label>
                  <input className="input" placeholder="+92..." value={regForm.phone} onChange={e => setRegForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="input-group" style={{ marginTop: 10, marginBottom: 16 }}>
                <label className="input-label">Password</label>
                <input type="password" className="input" placeholder="Create password" value={regForm.password} onChange={e => setRegForm(f => ({ ...f, password: e.target.value }))} required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReg(false)}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Create Account</button>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          Tataheer Business Group © 2026 — Secure ERP Platform
        </div>
      </div>
    </div>
  )
}
