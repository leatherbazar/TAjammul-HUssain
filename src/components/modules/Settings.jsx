import React, { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'

function BackupRestore() {
  const { refreshData } = useApp()
  const [backing, setBacking]     = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restorePreview, setRestorePreview] = useState(null)
  const [restoreFile, setRestoreFile]       = useState(null)
  const [lastBackup, setLastBackup] = useState(() => localStorage.getItem('tat_last_backup') || null)
  const fileRef = useRef()

  const handleBackup = async () => {
    setBacking(true)
    try {
      const res = await fetch('/api/backup')
      if (!res.ok) { toast.error('Backup failed!'); return }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const date = new Date().toISOString().slice(0, 10)
      a.href     = url
      a.download = `tataheer-erp-backup-${date}.json`
      a.click()
      URL.revokeObjectURL(url)
      const now = new Date().toLocaleString()
      setLastBackup(now)
      localStorage.setItem('tat_last_backup', now)
      toast.success('✅ Backup downloaded successfully!')
    } catch { toast.error('Backup failed. Check connection.') }
    finally { setBacking(false) }
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!data.collections) { toast.error('Invalid backup file!'); return }
        setRestoreFile(data)
        // Build preview
        const preview = Object.entries(data.collections).map(([key, val]) => ({
          key, count: Array.isArray(val) ? val.length : 0
        })).filter(x => x.count > 0)
        setRestorePreview({ preview, exportedAt: data.exportedAt, version: data.version })
      } catch { toast.error('Cannot read file. Make sure it is a valid backup JSON.') }
    }
    reader.readAsText(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleRestore = async () => {
    if (!restoreFile) return
    if (!window.confirm('⚠️ This will REPLACE all current data with the backup. Are you sure?')) return
    setRestoring(true)
    try {
      const res = await fetch('/api/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(restoreFile)
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Restore failed'); return }
      toast.success('✅ Data restored successfully! Refreshing...')
      setRestorePreview(null)
      setRestoreFile(null)
      setTimeout(() => { refreshData(); }, 1500)
    } catch { toast.error('Restore failed. Check connection.') }
    finally { setRestoring(false) }
  }

  return (
    <div className="section-box">
      <div className="section-title">💾 Backup & Restore</div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
        Export all your data as a JSON file and restore it anytime. Recommended: backup weekly.
      </p>

      {/* Last Backup Info */}
      {lastBackup && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', fontSize: 12, color: 'var(--green)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          ✅ Last backup: {lastBackup}
        </div>
      )}

      {/* BACKUP */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📥 Download Backup</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Downloads complete database: invoices, contacts, inventory, quotations, finances & all settings.
        </p>
        <button
          className="btn btn-primary"
          onClick={handleBackup}
          disabled={backing}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center' }}
        >
          {backing ? '⏳ Preparing...' : '📥 Download Full Backup'}
        </button>
      </div>

      <div className="divider" />

      {/* RESTORE */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>📤 Restore from Backup</div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Select a previously downloaded backup file to restore all data.
        </p>

        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
        <button
          className="btn btn-secondary"
          onClick={() => fileRef.current?.click()}
          style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
        >
          📂 Select Backup File (.json)
        </button>

        {/* Preview */}
        {restorePreview && (
          <div style={{ padding: 14, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 8 }}>
              📋 Backup Preview
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Exported: {new Date(restorePreview.exportedAt).toLocaleString()} | Version: {restorePreview.version}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {restorePreview.preview.map(({ key, count }) => (
                <div key={key} style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{key}</span>
                  <span style={{ fontWeight: 700, color: 'var(--green)' }}>{count}</span>
                </div>
              ))}
            </div>
            <button
              className="btn btn-danger"
              onClick={handleRestore}
              disabled={restoring}
              style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
            >
              {restoring ? '⏳ Restoring...' : '⚠️ Restore This Backup'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setRestorePreview(null); setRestoreFile(null) }}
              style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Settings() {
  const { data, updateNested } = useApp()
  const [invoiceStart, setInvoiceStart] = useState(data.settings?.invoiceCounter || 201)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>⚙️ <span>Settings</span></h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Invoice Settings */}
        <div className="section-box">
          <div className="section-title">🧾 Invoice Settings</div>
          <div className="input-group" style={{ marginBottom: 14 }}>
            <label className="input-label">Next Invoice Number</label>
            <input type="number" className="input" value={invoiceStart}
              onChange={e => setInvoiceStart(e.target.value)} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Next invoice will be: INV-{invoiceStart}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            updateNested('settings', 'invoiceCounter', parseInt(invoiceStart) || 201)
            toast.success('Invoice counter updated!')
          }}>Save</button>

          <div className="divider" />

          {/* Company Info */}
          <div className="section-title" style={{ marginTop: 0 }}>🏢 Company Info</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <div>📍 426- Ali Arcade, 13-km Main Multan Road, Lahore</div>
            <div>📞 +92(314)4094900</div>
            <div>✉️ tataheertraders@gmail.com</div>
          </div>
        </div>

        {/* Backup & Restore */}
        <BackupRestore />

      </div>
    </div>
  )
}
