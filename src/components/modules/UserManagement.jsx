import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import MasterCodeModal from '../common/MasterCodeModal'
import toast from 'react-hot-toast'

export default function UserManagement() {
  const { data, updateNested, update } = useApp()
  const [tab, setTab] = useState('employees')
  const [masterAction, setMasterAction] = useState(null)
  const [empForm, setEmpForm] = useState({ name: '', username: '', password: '', phone: '', role: 'field', active: true })
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [newMasterCode, setNewMasterCode] = useState('')
  const [changingCode, setChangingCode] = useState(false)
  const [adminPwd, setAdminPwd] = useState({ current: '', newPwd: '', confirm: '' })

  const employees = data.users?.employees || []
  const clients = data.users?.clients || []

  const addEmployee = async () => {
    if (!empForm.name || !empForm.username || !empForm.password) { toast.error('Fill all required fields.'); return }
    if (employees.find(e => e.username === empForm.username)) { toast.error('Username taken.'); return }
    try {
      const res = await fetch('/api/users/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...empForm, id: Date.now().toString(), createdAt: new Date().toISOString() })
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Failed to create employee.'); return }
      updateNested('users', 'employees', [...employees, data])
      setEmpForm({ name: '', username: '', password: '', phone: '', role: 'field', active: true })
      setShowEmpForm(false)
      toast.success(`Employee ${data.name} created!`)
    } catch {
      toast.error('Connection error. Is the server running?')
    }
  }

  const toggleEmpStatus = (id) => {
    updateNested('users', 'employees', employees.map(e => e.id === id ? { ...e, active: !e.active } : e))
  }

  const deleteEmployee = (id) => setMasterAction({ type: 'deleteEmp', id })
  const deleteClient = (id) => setMasterAction({ type: 'deleteClient', id })

  const changeMasterCode = () => {
    if (newMasterCode.length < 4) { toast.error('Code must be at least 4 characters.'); return }
    update('masterCode', newMasterCode)
    setNewMasterCode('')
    setChangingCode(false)
    toast.success('Master code updated!')
  }

  const changeAdminPwd = () => {
    if (adminPwd.current !== data.users.admin.password) { toast.error('Current password incorrect.'); return }
    if (adminPwd.newPwd !== adminPwd.confirm) { toast.error('Passwords do not match.'); return }
    if (adminPwd.newPwd.length < 6) { toast.error('Password too short.'); return }
    updateNested('users', 'admin', { ...data.users.admin, password: adminPwd.newPwd })
    setAdminPwd({ current: '', newPwd: '', confirm: '' })
    toast.success('Admin password changed!')
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>👥 <span>User Management</span></h2>
      </div>

      <div className="tabs">
        {[['employees', '👷 Employees'], ['clients', '🤝 Clients'], ['security', '🔐 Security']].map(([k, l]) => (
          <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* EMPLOYEES */}
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
                <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {employees.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No employees. Add your first team member.</td></tr>}
                  {employees.map(emp => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td className="font-mono" style={{ fontSize: 12 }}>{emp.username}</td>
                      <td><span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{emp.role}</span></td>
                      <td style={{ fontSize: 12 }}>{emp.phone || '—'}</td>
                      <td>
                        <span className={`badge badge-${emp.active ? 'approved' : 'cancelled'}`}>{emp.active ? 'Active' : 'Disabled'}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-xs" onClick={() => toggleEmpStatus(emp.id)}>{emp.active ? 'Disable' : 'Enable'}</button>
                          <button className="btn btn-danger btn-xs" onClick={() => deleteEmployee(emp.id)}>🗑️</button>
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

      {/* CLIENTS */}
      {tab === 'clients' && (
        <div className="section-box">
          <div className="section-title">Client Accounts ({clients.length})</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Username</th><th>Company</th><th>Phone</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>
                {clients.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>No clients registered yet.</td></tr>}
                {clients.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td className="font-mono" style={{ fontSize: 12 }}>{c.username}</td>
                    <td>{c.company || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.phone || '—'}</td>
                    <td style={{ fontSize: 12 }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
                    <td><button className="btn btn-danger btn-xs" onClick={() => deleteClient(c.id)}>🗑️</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECURITY */}
      {tab === 'security' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Master Code */}
          <div className="section-box">
            <div className="section-title">🔐 Master Security Code</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              The master code (default: 5555) is required for all edit/delete operations across the system.
            </p>
            {!changingCode ? (
              <button className="btn btn-warning" onClick={() => setMasterAction({ type: 'changeMasterCode' })}>Change Master Code</button>
            ) : (
              <div>
                <div className="input-group" style={{ marginBottom: 12 }}>
                  <label className="input-label">New Master Code</label>
                  <input className="input" value={newMasterCode} onChange={e => setNewMasterCode(e.target.value)} placeholder="Min 4 characters" maxLength={10} style={{ letterSpacing: 6, textAlign: 'center', fontFamily: 'Orbitron, monospace', fontSize: 18 }} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary" onClick={() => setChangingCode(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={changeMasterCode}>Update Code</button>
                </div>
              </div>
            )}
          </div>

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
              </div>
              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input type="password" className="input" value={adminPwd.confirm} onChange={e => setAdminPwd(f => ({ ...f, confirm: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={changeAdminPwd}>Update Password</button>
            </div>
          </div>
        </div>
      )}

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
