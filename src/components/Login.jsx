import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import toast from 'react-hot-toast'

const PORTALS = [
  { key: 'admin',    label: '🛡️ Admin',    color: 'var(--red)' },
  { key: 'employee', label: '👷 Employee', color: 'var(--blue)' },
  { key: 'client',   label: '🤝 Client',   color: 'var(--green)' },
]

export default function Login() {
  const { setCurrentUser } = useApp()
  const navigate = useNavigate()
  const [portal, setPortal]     = useState('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showReg, setShowReg]         = useState(false)
  const [regForm, setRegForm]         = useState({ name: '', username: '', password: '', company: '', phone: '' })
  const [showForgot, setShowForgot]   = useState(false)
  const [forgotUser, setForgotUser]   = useState('')
  const [forgotResult, setForgotResult] = useState(null)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const user = await res.json()
      if (!res.ok) {
        toast.error(user.error || 'Invalid credentials.')
        return
      }
      if (user.role !== portal) {
        const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'employee' ? 'Employee' : 'Client'
        toast.error(`Wrong portal! This is a ${roleLabel} account. Please select the "${roleLabel}" tab above.`)
        return
      }
      setCurrentUser(user)
      toast.success(`Welcome, ${user.name}!`)
      navigate(`/${user.role}`)
    } catch {
      toast.error('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotResult(null)
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUser })
      })
      const data = await res.json()
      if (!res.ok) {
        setForgotResult({ error: data.error })
      } else {
        setForgotResult({ password: data.password, name: data.name, role: data.role })
      }
    } catch {
      setForgotResult({ error: 'Connection error. Please try again.' })
    } finally {
      setForgotLoading(false)
    }
  }

  const handleClientRegister = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Registration failed.')
        return
      }
      toast.success('Account created! Please login.')
      setShowReg(false)
      setUsername(regForm.username)
      setPassword(regForm.password)
      setRegForm({ name: '', username: '', password: '', company: '', phone: '' })
    } catch {
      toast.error('Connection error. Please try again.')
    } finally {
      setLoading(false)
    }
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
            {portal === 'admin'    && '🛡️ Administrator Login'}
            {portal === 'employee' && '👷 Employee Login'}
            {portal === 'client'   && '🤝 Client Portal'}
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

              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotUser(username); setForgotResult(null) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Forgot Password?
                </button>
              </div>

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
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowReg(false)} disabled={loading}>Back</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--text-muted)' }}>
          Tataheer Business Group © 2026 — Secure ERP Platform
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="glass" style={{ padding: 28, width: '90%', maxWidth: 360 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, textAlign: 'center' }}>🔑 Forgot Password</h3>
            <form onSubmit={handleForgotPassword}>
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Username</label>
                <input
                  className="input"
                  placeholder="Enter your username"
                  value={forgotUser}
                  onChange={e => { setForgotUser(e.target.value); setForgotResult(null) }}
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginBottom: 10 }} disabled={forgotLoading}>
                {forgotLoading ? 'Searching...' : 'Get Password'}
              </button>
            </form>

            {forgotResult && (
              forgotResult.error
                ? <div style={{ color: 'var(--red)', textAlign: 'center', fontSize: 13, marginBottom: 10 }}>{forgotResult.error}</div>
                : <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 16px', marginBottom: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Account found — {forgotResult.name}</div>
                    <div style={{ fontSize: 13 }}>Your password is:</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: 'var(--red)', margin: '6px 0' }}>{forgotResult.password}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>Role: {forgotResult.role}</div>
                  </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => { setShowForgot(false); setForgotResult(null); setForgotUser('') }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
