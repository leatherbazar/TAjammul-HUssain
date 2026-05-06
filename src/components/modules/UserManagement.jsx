import React, { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import MasterCodeModal from '../common/MasterCodeModal'
import toast from 'react-hot-toast'

// Password strength helper
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

function PwdStrengthBar({ pwd }) {
  const s = pwdStrength(pwd)
  if (!pwd || !s) return null
  return (
    <div style={{ marginTop: 5 }}>
      <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, transition: 'all 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, color: s.color }}>{s.label}</span>
    </div>
  )
}

const EMPLOYEE_MODULES = [
  { key: 'dashboard',     label: '📊 Dashboard' },
  { key: 'supply-orders', label: '🛒 Supply Orders' },
  { key: 'quotations',    label: '📋 Quotations' },
  { key: 'inventory',     label: '📦 Inventory' },
  { key: 'invoices',      label: '🧾 Invoices' },
  { key: 'sales',         label: '🛍️ Sales' },
  { key: 'purchases',     label: '🏭 Purchases' },
  { key: 'finance',       label: '💰 Finance' },
  { key: 'ledger',        label: '📗 Ledger' },
  { key: 'contacts',      label: '📒 Contacts' },
]

const ACTION_LABELS = {
  login:            { label: 'Login', color: '#22c55e', icon: '✅' },
  login_failed:     { label: 'Failed Login', color: '#f59e0b', icon: '⚠️' },
  logout:           { label: 'Logout', color: '#6b7280', icon: '🚪' },
  password_reset:   { label: 'Password Reset', color: '#3b82f6', icon: '🔑' },
  password_changed: { label: 'Password Changed', color: '#8b5cf6', icon: '🔏' },
  account_locked:   { label: 'Account Locked', color: '#ef4444', icon: '🔒' },
  account_unlocked: { label: 'Account Unlocked', color: '#22c55e', icon: '🔓' },
  account_hidden:   { label: 'Account Hidden', color: '#6b7280', icon: '👁️' },
  account_unhidden: { label: 'Account Visible', color: '#22c55e', icon: '👁️' },
}

export default function UserManagement() {
  const { data, updateNested, update, refreshData, currentUser } = useApp()
  const [tab, setTab] = useState('employees')
  const [refreshing, setRefreshing] = useState(false)
  const [masterAction, setMasterAction] = useState(null)

  // Employee form
  const [empForm, setEmpForm] = useState({ name: '', username: '', password: '', phone: '', role: 'field', active: true })
  const [showEmpForm, setShowEmpForm] = useState(false)

  // Security tab state
  const [secSettings, setSecSettings] = useState({ sessionTimeout: 30, maxLoginAttempts: 5, lockDuration: 15, recoveryPin: '1234', backupCode: 'TAT-2026-RESET' })
  const [secLoading, setSecLoading] = useState(false)
  const [auditLog, setAuditLog] = useState([])
  const [auditLoading, setAuditLoading] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  // Admin password
  const [adminPwd, setAdminPwd] = useState({ current: '', newPwd: '', confirm: '' })

  // Change any user password
  const [changePwd, setChangePwd] = useState({ username: '', newPwd: '', confirm: '' })
  const [changePwdLoading, setChangePwdLoading] = useState(false)

  // Permissions modal
  const [permModal, setPermModal] = useState(null) // { emp }
  const [permState, setPermState] = useState({})

  // Master code
  const [newMasterCode, setNewMasterCode] = useState('')
  const [changingCode, setChangingCode] = useState(false)

  const employees = data.users?.employees || []
  const clients   = data.users?.clients   || []

  // Load security settings & audit log on mount
  useEffect(() => {
    fetch('/api/security-settings').then(r => r.json()).then(d => setSecSettings(d)).catch(() => {})
  }, [])

  const loadAuditLog = async () => {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/audit-log')
      const logs = await res.json()
      setAuditLog(logs)
    } catch { toast.error('Failed to load audit log.') }
    finally { setAuditLoading(false) }
  }

  useEffect(() => { if (tab === 'security') loadAuditLog() }, [tab])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshData()
    setRefreshing(false)
  }

  // ── Employee Actions ──────────────────────────────────────────────────────────
  const addEmployee = async () => {
    if (!empForm.name || !empForm.username || !empForm.password) { toast.error('Fill all required fields.'); return }
    if (employees.find(e => e.username === empForm.username)) { toast.error('Username taken.'); return }
    try {
      const res = await fetch('/api/users/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...empForm, id: Date.now().toString(), createdAt: new Date().toISOString() })
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || 'Failed.'); return }
      updateNested('users', 'employees', [...employees, d])
      setEmpForm({ name: '', username: '', password: '', phone: '', role: 'field', active: true })
      setShowEmpForm(false)
      toast.success(`Employee ${d.name} created!`)
    } catch { toast.error('Connection error.') }
  }

  const toggleEmpStatus = (id) => {
    updateNested('users', 'employees', employees.map(e => e.id === id ? { ...e, active: !e.active } : e))
  }

  const toggleHide = async (user) => {
    try {
      const res = await fetch(`/api/users/${user.id}/hide`, { method: 'PUT' })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error); return }
      const type = user.role === 'employee' ? 'employees' : 'clients'
      const list = type === 'employees' ? employees : clients
      updateNested('users', type, list.map(u => u.id === user.id ? { ...u, hidden: d.hidden } : u))
      toast.success(d.hidden ? `${user.name} is now hidden.` : `${user.name} is now visible.`)
    } catch { toast.error('Connection error.') }
  }

  const unlockAccount = async (user) => {
    try {
      await fetch(`/api/users/${user.id}/unlock`, { method: 'PUT' })
      toast.success(`${user.name}'s account unlocked.`)
      await handleRefresh()
    } catch { toast.error('Connection error.') }
  }

  const openPermissions = (emp) => {
    setPermState(emp.permissions || {})
    setPermModal(emp)
  }

  const savePermissions = async () => {
    try {
      await fetch(`/api/users/${permModal.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permState })
      })
      updateNested('users', 'employees', employees.map(e => e.id === permModal.id ? { ...e, permissions: permState } : e))
      toast.success('Permissions updated.')
      setPermModal(null)
    } catch { toast.error('Connection error.') }
  }

  // ── Admin Password ────────────────────────────────────────────────────────────
  const changeAdminPwd = () => {
    if (adminPwd.current !== data.users.admin.password) { toast.error('Current password incorrect.'); return }
    if (adminPwd.newPwd !== adminPwd.confirm) { toast.error('Passwords do not match.'); return }
    if (adminPwd.newPwd.length < 6) { toast.error('Password too short (min 6).'); return }
    updateNested('users', 'admin', { ...data.users.admin, password: adminPwd.newPwd })
    // Log to audit
    fetch('/api/audit-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: currentUser?.name || 'Admin', userRole: 'admin', action: 'password_changed', detail: 'Admin changed own password' }) })
    setAdminPwd({ current: '', newPwd: '', confirm: '' })
    toast.success('Admin password changed!')
  }

  // ── Change Any User Password ─────────────────────────────────────────────────
  const handleChangePwd = async () => {
    if (!changePwd.username) { toast.error('Select a user.'); return }
    if (!changePwd.newPwd) { toast.error('Enter new password.'); return }
    if (changePwd.newPwd !== changePwd.confirm) { toast.error('Passwords do not match.'); return }
    setChangePwdLoading(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: changePwd.username, newPassword: changePwd.newPwd, adminName: currentUser?.name || 'Admin' })
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error); return }
      toast.success(`Password changed for ${changePwd.username}!`)
      setChangePwd({ username: '', newPwd: '', confirm: '' })
    } catch { toast.error('Connection error.') }
    finally { setChangePwdLoading(false) }
  }

  // ── Master Code ───────────────────────────────────────────────────────────────
  const changeMasterCode = () => {
    if (newMasterCode.length < 4) { toast.error('Code must be at least 4 characters.'); return }
    update('masterCode', newMasterCode)
    setNewMasterCode(''); setChangingCode(false)
    toast.success('Master code updated!')
  }

  // ── Security Settings ─────────────────────────────────────────────────────────
  const saveSecSettings = async () => {
    setSecLoading(true)
    try {
      await fetch('/api/security-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(secSettings) })
      toast.success('Security settings saved!')
    } catch { toast.error('Failed to save.') }
    finally { setSecLoading(false) }
  }

  // ── All usernames for change-password dropdown ────────────────────────────────
  const allUsers = [
    ...employees.map(e => ({ username: e.username, label: `👷 ${e.name} (employee)` })),
    ...clients.map(c => ({ username: c.username, label: `🤝 ${c.name} (client)` })),
    { username: 'admin', label: '🛡️ Administrator (admin)' },
  ]

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>👥 <span>User Management</span></h2>
        <button className="btn btn-secondary btn-sm" onClick={handleRefresh} disabled={refreshing}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>🔄</span>
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="tabs">
        {[['employees', '👷 Employees'], ['clients', '🤝 Clients'], ['security', '🔐 Security']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ══ EMPLOYEES ══════════════════════════════════════════════════════════ */}
      {tab === 'employees' && (
        <div>
          <div className="section-box">
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <span>Employee Accounts ({employees.length})</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowEmpForm(v => !v)}>+ Add Employee</button>
            </div>

            {showEmpForm && (
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', marginBottom: 14 }}>
                <div className="form-grid form-grid-3">
                  <div className="input-group">
                    <label className="input-label">Full Name *</label>
                    <input className="input" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Username *</label>
                    <input className="input" value={empForm.username} onChange={e => setEmpForm(f => ({ ...f, username: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Password *</label>
                    <input type="password" className="input" value={empForm.password} onChange={e => setEmpForm(f => ({ ...f, password: e.target.value }))} />
                    <PwdStrengthBar pwd={empForm.password} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Phone</label>
                    <input className="input" value={empForm.phone} onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Role</label>
                    <select className="input" value={empForm.role} onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))}>
                      <option value="field">Field (Market)</option>
                      <option value="office">Office</option>
                      <option value="warehouse">Warehouse</option>
                      <option value="accounts">Accounts</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={() => setShowEmpForm(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={addEmployee}>Create Employee</button>
                </div>
              </div>
            )}

            <div className="table-wrapper">
              <table>
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Phone</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
                <tbody>
                  {employees.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No employees. Add your first team member.</td></tr>}
                  {employees.map(emp => (
                    <tr key={emp.id} style={{ opacity: emp.hidden ? 0.5 : 1 }}>
                      <td style={{ fontWeight: 600 }}>
                        {emp.hidden && <span title="Hidden" style={{ marginRight: 4 }}>🙈</span>}
                        {emp.lockedUntil && new Date() < new Date(emp.lockedUntil) && <span title="Locked" style={{ marginRight: 4 }}>🔒</span>}
                        {emp.name}
                      </td>
                      <td className="font-mono" style={{ fontSize: 12 }}>{emp.username}</td>
                      <td><span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{emp.role}</span></td>
                      <td style={{ fontSize: 12 }}>{emp.phone || '—'}</td>
                      <td><span className={`badge badge-${emp.active ? 'approved' : 'cancelled'}`}>{emp.active ? 'Active' : 'Disabled'}</span></td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{emp.lastLogin ? new Date(emp.lastLogin).toLocaleString() : 'Never'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          <button className="btn btn-secondary btn-xs" onClick={() => toggleEmpStatus(emp.id)} title={emp.active ? 'Disable login' : 'Enable login'}>{emp.active ? 'Disable' : 'Enable'}</button>
                          <button className="btn btn-secondary btn-xs" onClick={() => toggleHide(emp)} title={emp.hidden ? 'Unhide account' : 'Hide account'}>{emp.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                          <button className="btn btn-secondary btn-xs" onClick={() => openPermissions(emp)} title="Module access">🔧 Access</button>
                          {emp.lockedUntil && new Date() < new Date(emp.lockedUntil) && (
                            <button className="btn btn-warning btn-xs" onClick={() => unlockAccount(emp)} title="Unlock account">🔓 Unlock</button>
                          )}
                          <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'deleteEmp', id: emp.id })} title="Delete">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ CLIENTS ════════════════════════════════════════════════════════════ */}
      {tab === 'clients' && (
        <div className="section-box">
          <div className="section-title">Client Accounts ({clients.length})</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Company</th><th>Phone</th><th>Joined</th><th>Last Login</th><th>Actions</th></tr></thead>
              <tbody>
                {clients.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No clients registered yet.</td></tr>}
                {clients.map(c => (
                  <tr key={c.id} style={{ opacity: c.hidden ? 0.5 : 1 }}>
                    <td style={{ fontWeight: 600 }}>
                      {c.hidden && <span title="Hidden" style={{ marginRight: 4 }}>🙈</span>}
                      {c.name}
                    </td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{c.username}</td>
                    <td>{c.company || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.lastLogin ? new Date(c.lastLogin).toLocaleString() : 'Never'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button className="btn btn-secondary btn-xs" onClick={() => toggleHide(c)}>{c.hidden ? '👁️ Show' : '🙈 Hide'}</button>
                        <button className="btn btn-danger btn-xs" onClick={() => setMasterAction({ type: 'deleteClient', id: c.id })}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SECURITY ═══════════════════════════════════════════════════════════ */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Row 1: Admin Password + Change Any User Password */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Admin Password */}
            <div className="section-box">
              <div className="section-title">🛡️ Admin Password</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">Current Password</label>
                  <input type="password" className="input" value={adminPwd.current} onChange={e => setAdminPwd(f => ({ ...f, current: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">New Password</label>
                  <input type="password" className="input" value={adminPwd.newPwd} onChange={e => setAdminPwd(f => ({ ...f, newPwd: e.target.value }))} />
                  <PwdStrengthBar pwd={adminPwd.newPwd} />
                </div>
                <div className="input-group">
                  <label className="input-label">Confirm New Password</label>
                  <input type="password" className="input" value={adminPwd.confirm} onChange={e => setAdminPwd(f => ({ ...f, confirm: e.target.value }))} />
                </div>
                <button className="btn btn-primary" onClick={changeAdminPwd}>Update Admin Password</button>
              </div>
            </div>

            {/* Change Any User Password */}
            <div className="section-box">
              <div className="section-title">🔏 Change Any User Password</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Admin override — no old password needed.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="input-group">
                  <label className="input-label">Select User</label>
                  <select className="input" value={changePwd.username} onChange={e => setChangePwd(f => ({ ...f, username: e.target.value }))}>
                    <option value="">— Choose user —</option>
                    {allUsers.map(u => <option key={u.username} value={u.username}>{u.label}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">New Password</label>
                  <input type="password" className="input" placeholder="Min 6 characters" value={changePwd.newPwd} onChange={e => setChangePwd(f => ({ ...f, newPwd: e.target.value }))} />
                  <PwdStrengthBar pwd={changePwd.newPwd} />
                </div>
                <div className="input-group">
                  <label className="input-label">Confirm Password</label>
                  <input type="password" className="input" value={changePwd.confirm} onChange={e => setChangePwd(f => ({ ...f, confirm: e.target.value }))} />
                </div>
                <button className="btn btn-primary" onClick={handleChangePwd} disabled={changePwdLoading}>
                  {changePwdLoading ? 'Saving...' : '🔏 Change Password'}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Security Settings + Master Code */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Security Settings */}
            <div className="section-box">
              <div className="section-title">⚙️ Security Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">⏱️ Auto Logout (minutes of inactivity)</label>
                  <input type="number" className="input" min={5} max={480} value={secSettings.sessionTimeout}
                    onChange={e => setSecSettings(s => ({ ...s, sessionTimeout: +e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">🚫 Max Failed Login Attempts</label>
                  <input type="number" className="input" min={3} max={20} value={secSettings.maxLoginAttempts}
                    onChange={e => setSecSettings(s => ({ ...s, maxLoginAttempts: +e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">⏳ Lock Duration (minutes)</label>
                  <input type="number" className="input" min={1} max={1440} value={secSettings.lockDuration}
                    onChange={e => setSecSettings(s => ({ ...s, lockDuration: +e.target.value }))} />
                </div>
                <button className="btn btn-primary" onClick={saveSecSettings} disabled={secLoading}>
                  {secLoading ? 'Saving...' : '💾 Save Settings'}
                </button>
              </div>
            </div>

            {/* Recovery Codes */}
            <div className="section-box">
              <div className="section-title">🔑 Recovery & Backup Codes</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Used for password reset from the login page without admin access.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="input-group">
                  <label className="input-label">Recovery PIN (for users)</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input" type={showSecrets ? 'text' : 'password'}
                      value={secSettings.recoveryPin} onChange={e => setSecSettings(s => ({ ...s, recoveryPin: e.target.value }))}
                      style={{ letterSpacing: showSecrets ? 4 : 6, fontFamily: 'monospace', paddingRight: 44 }} />
                    <button type="button" onClick={() => setShowSecrets(v => !v)}
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>
                      {showSecrets ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Backup Code (emergency access)</label>
                  <input className="input" type={showSecrets ? 'text' : 'password'}
                    value={secSettings.backupCode} onChange={e => setSecSettings(s => ({ ...s, backupCode: e.target.value }))}
                    style={{ letterSpacing: 2, fontFamily: 'monospace' }} />
                </div>
                <button className="btn btn-primary" onClick={saveSecSettings} disabled={secLoading}>
                  {secLoading ? 'Saving...' : '💾 Save Codes'}
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Master Code */}
          <div className="section-box">
            <div className="section-title">🔐 Master Security Code</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              The master code (default: 5555) is required for all edit/delete operations across the system.
            </p>
            {!changingCode ? (
              <button className="btn btn-warning" onClick={() => setMasterAction({ type: 'changeMasterCode' })}>Change Master Code</button>
            ) : (
              <div>
                <div className="input-group" style={{ marginBottom: 12, maxWidth: 300 }}>
                  <label className="input-label">New Master Code</label>
                  <input className="input" value={newMasterCode} onChange={e => setNewMasterCode(e.target.value)} placeholder="Min 4 characters" maxLength={10}
                    style={{ letterSpacing: 6, textAlign: 'center', fontFamily: 'Orbitron, monospace', fontSize: 18 }} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setChangingCode(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={changeMasterCode}>Update Code</button>
                </div>
              </div>
            )}
          </div>

          {/* Row 4: Audit Log */}
          <div className="section-box">
            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <span>📋 Activity & Audit Log</span>
              <button className="btn btn-secondary btn-sm" onClick={loadAuditLog} disabled={auditLoading}>
                {auditLoading ? '...' : '🔄 Refresh'}
              </button>
            </div>
            <div className="table-wrapper" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table>
                <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Detail</th></tr></thead>
                <tbody>
                  {auditLog.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>{auditLoading ? 'Loading...' : 'No activity recorded yet.'}</td></tr>}
                  {auditLog.map((log, i) => {
                    const meta = ACTION_LABELS[log.action] || { label: log.action, color: '#6b7280', icon: '•' }
                    return (
                      <tr key={i}>
                        <td style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                        </td>
                        <td style={{ fontWeight: 600, fontSize: 13 }}>{log.userName}</td>
                        <td><span style={{ textTransform: 'capitalize', fontSize: 11 }}>{log.userRole}</span></td>
                        <td>
                          <span style={{ color: meta.color, fontWeight: 600, fontSize: 12 }}>
                            {meta.icon} {meta.label}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{log.detail}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Permissions Modal ──────────────────────────────────────────────── */}
      {permModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div className="glass" style={{ padding: 24, width: '100%', maxWidth: 400 }}>
            <h3 style={{ marginBottom: 4, fontSize: 15, fontWeight: 700 }}>🔧 Module Access</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>{permModal.name} ({permModal.username})</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {EMPLOYEE_MODULES.map(mod => (
                <label key={mod.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, padding: '6px 10px', borderRadius: 8, background: permState[mod.key] !== false ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${permState[mod.key] !== false ? 'var(--red)' : 'transparent'}` }}>
                  <input type="checkbox" checked={permState[mod.key] !== false} onChange={e => setPermState(p => ({ ...p, [mod.key]: e.target.checked }))} />
                  {mod.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPermModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={savePermissions}>Save Access</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Master Code Modal ──────────────────────────────────────────────── */}
      {masterAction && (
        <MasterCodeModal
          title={masterAction.type === 'changeMasterCode' ? 'Verify Current Master Code' : 'Confirm Delete'}
          onSuccess={() => {
            if (masterAction.type === 'deleteEmp') {
              updateNested('users', 'employees', employees.filter(e => e.id !== masterAction.id))
              toast.success('Employee removed.')
            } else if (masterAction.type === 'deleteClient') {
              updateNested('users', 'clients', clients.filter(c => c.id !== masterAction.id))
              toast.success('Client removed.')
            } else if (masterAction.type === 'changeMasterCode') {
              setChangingCode(true)
            }
            setMasterAction(null)
          }}
          onCancel={() => setMasterAction(null)}
        />
      )}
    </div>
  )
}
