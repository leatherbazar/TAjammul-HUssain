import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'

export default function MasterCodeModal({ onSuccess, onCancel, title = 'Enter Master Code' }) {
  const { verifyMasterCode } = useApp()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (verifyMasterCode(code)) {
      onSuccess()
    } else {
      setError('Incorrect master code. Access denied.')
      setShake(true)
      setCode('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className={`modal fade-in ${shake ? 'shake' : ''}`}
        style={{ maxWidth: 360 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-title">
          <span style={{ fontSize: 24 }}>🔐</span>
          {title}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
          This action requires the Master Security Code.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="input-group" style={{ marginBottom: 16 }}>
            <label className="input-label">Master Code</label>
            <input
              type="password"
              className="input"
              placeholder="Enter code..."
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
              autoFocus
              maxLength={10}
              style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8, fontFamily: 'Orbitron, monospace' }}
            />
          </div>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 7, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', color: 'var(--red)', fontSize: 12, marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" className="btn btn-secondary w-full" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary w-full" disabled={!code}>Confirm</button>
          </div>
        </form>
      </div>
      <style>{`.shake { animation: shakeAnim 0.4s; } @keyframes shakeAnim { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }`}</style>
    </div>
  )
}
