import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import toast from 'react-hot-toast'

const PORTALS = [
  { key: 'admin',    label: '🛡️ Admin',    color: 'var(--red)' },
  { key: 'employee', label: '👷 Employee', color: 'var(--blue)' },
  { key: 'client',   label: '🤝 Client',   color: 'var(--green)' },
]

function pwdStrength(pwd) {
  if (!pwd) return null
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[0-9]/.test(pwd)) score++
  if (/[!@#$%^&*]/.test(pwd)) score++
  if (/[A-Z]/.test(pwd)) score++
  if (score <= 1) return { label: 'Weak', color: '#ef4444', pct: 25 }
  if (score <= 2) return { label: 'Fair', color: '#f59e0b', pct: 50 }
  if (score <= 3) return { label: 'Good', color: '#3b82f6', pct: 75 }
  return { label: 'Strong', color: '#22c55e', pct: 100 }
}

export default function Login() {
  const { setCurrentUser } = useApp()
  const navigate = useNavigate()
  const [portal, setPortal]     = useState('admin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [showReg, setShowReg]   = useState(false)
  const [regForm, setRegForm]   = useState({ name: '', username: '', password: '', company: '', phone: '' })

  // Reset Password flow
  const [showReset, setShowReset]         = useState(false)
  const [resetStep, setResetStep]         = useState(1) // 1=username, 2=pin, 3=new password
  const [resetUser, setResetUser]         = useState('')
  const [resetPin, setResetPin]           = useState('')
  const [resetNewPwd, setResetNewPwd]     = useState('')
  const [resetConfirm, setResetConfirm]   = useState('')
  const [resetLoading, setResetLoading]   = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  const strength = pwdStrength(resetNewPwd)

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
      if (!res.ok) { toast.error(data.error || 'Registration failed.'); return }
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

  const handleResetSubmit = async (e) => {
    e.preventDefault()
    if (resetStep === 1) { setResetStep(2); return }
    if (resetStep === 2) { setResetStep(3); return }
    // Step 3: submit
    if (resetNewPwd !== resetConfirm) { toast.error('Passwords do not match.'); return }
    if (resetNewPwd.length < 6) { toast.error('Password must be at least 6 characters.'); return }
    setResetLoading(true)
    try {
      const body = { username: resetUser, newPassword: resetNewPwd }
      if (useBackupCode) body.backupCode = resetPin
      else body.pin = resetPin
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Reset failed.'); return }
      toast.success('Password reset successfully! Please login.')
      setShowReset(false)
      setResetStep(1); setResetUser(''); setResetPin(''); setResetNewPwd(''); setResetConfirm('')
      setUsername(resetUser)
    } catch {
      toast.error('Connection error.')
    } finally {
      setResetLoading(false)
    }
  }

  const closeReset = () => {
    setShowReset(false); setResetStep(1)
    setResetUser(''); setResetPin(''); setResetNewPwd(''); setResetConfirm('')
    setUseBackupCode(false)
  }

  return (
    <div className="login-page">
      {/* Logo / Header */}
      <div className="login-header fade-in">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <img src="/logo-tat.png" alt="TAT Logo" style={{ height: 90, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.5))' }} />
          <img src="/tataheer-logo.png" alt="Tataheer Traders" style={{ height: 38, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6)) brightness(1.1)' }} />
        </div>
        <p style={{ marginTop: 6 }}>Enterprise Resource Planning System — 2026 Edition</p>
      </div>

      {/* Portal Selector */}
      <div style={{ width: '100%', maxWidth: 420, marginBottom: 0 }} className="fade-in">
        <div className="portal-selector">
          {PORTALS.map(p => (
            <button key={p.key} className={`portal-btn ${portal === p.key ? 'active' : ''}`}
              onClick={() => { setPortal(p.key); setUsername(''); setPassword('') }}
              style={portal === p.key ? { borderColor: p.color, color: p.color, background: `${p.color}22` } : {}}>
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
                <input className="input" placeholder={portal === 'admin' ? 'admin' : 'Enter username'}
                  value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
              </div>
              <div className="input-group" style={{ marginBottom: 20 }}>
                <label className="input-label">Password</label>
                <input type="password" className="input" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
                {loading ? <span className="spin" style={{ display: 'inline-block' }}>◌</span> : null}
                {loading ? ' Verifying...' : 'Sign In'}
              </button>

              {/* Forgot Password link */}
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button type="button" onClick={() => { setShowReset(true); setResetUser(username) }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                  🔑 Forgot Password? Reset here
                </button>
              </div>

              {portal === 'client' && (
                <div style={{ textAlign: 'center', marginTop: 10 }}>
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

      {/* ── Reset Password Modal ── */}
      {showReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass" style={{ padding: 28, width: '100%', maxWidth: 380 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, textAlign: 'center' }}>🔑 Reset Password</h3>

            {/* Step indicator */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {['Username', 'Verify PIN', 'New Password'].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: resetStep > i ? 'var(--red)' : resetStep === i + 1 ? 'var(--red)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i + 1}</div>
                  {i < 2 && <div style={{ width: 20, height: 2, background: resetStep > i + 1 ? 'var(--red)' : 'rgba(255,255,255,0.1)' }} />}
                </div>
              ))}
            </div>

            <form onSubmit={handleResetSubmit}>
              {resetStep === 1 && (
                <div className="input-group" style={{ marginBottom: 16 }}>
                  <label className="input-label">Enter your Username</label>
                  <input className="input" placeholder="Username" value={resetUser} onChange={e => setResetUser(e.target.value)} required autoFocus />
                </div>
              )}

              {resetStep === 2 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, textAlign: 'center' }}>
                    Enter the Recovery PIN set by admin, or use the Backup Code.
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10, justifyContent: 'center' }}>
                    <button type="button" onClick={() => setUseBackupCode(false)}
                      className={`btn btn-sm ${!useBackupCode ? 'btn-primary' : 'btn-secondary'}`}>Recovery PIN</button>
                    <button type="button" onClick={() => setUseBackupCode(true)}
                      className={`btn btn-sm ${useBackupCode ? 'btn-primary' : 'btn-secondary'}`}>Backup Code</button>
                  </div>
                  <div className="input-group">
                    <label className="input-label">{useBackupCode ? 'Backup Code' : 'Recovery PIN'}</label>
                    <input className="input" placeholder={useBackupCode ? 'e.g. TAT-2026-RESET' : 'Enter PIN'}
                      value={resetPin} onChange={e => setResetPin(e.target.value)} required autoFocus
                      style={!useBackupCode ? { letterSpacing: 6, textAlign: 'center', fontFamily: 'monospace', fontSize: 18 } : {}} />
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="input-group" style={{ marginBottom: 12 }}>
                    <label className="input-label">New Password</label>
                    <input type="password" className="input" placeholder="Min 6 characters"
                      value={resetNewPwd} onChange={e => setResetNewPwd(e.target.value)} required autoFocus />
                    {resetNewPwd && strength && (
                      <div style={{ marginTop: 6 }}>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${strength.pct}%`, background: strength.color, transition: 'all 0.3s' }} />
                        </div>
                        <div style={{ fontSize: 11, color: strength.color, marginTop: 3 }}>{strength.label} password</div>
                      </div>
                    )}
                  </div>
                  <div className="input-group">
                    <label className="input-label">Confirm Password</label>
                    <input type="password" className="input" placeholder="Repeat password"
                      value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} required />
                    {resetConfirm && resetNewPwd !== resetConfirm && (
                      <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>Passwords do not match</div>
                    )}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={resetStep === 1 ? closeReset : () => setResetStep(s => s - 1)}>
                  {resetStep === 1 ? 'Cancel' : '← Back'}
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={resetLoading}>
                  {resetLoading ? 'Processing...' : resetStep === 3 ? '✅ Reset Password' : 'Next →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
