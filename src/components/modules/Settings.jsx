import React, { useState } from 'react'
import { useApp } from '../../context/AppContext'
import toast from 'react-hot-toast'

export default function Settings() {
  const { data, updateNested, update } = useApp()
  const [companyForm, setCompanyForm] = useState({
    name: 'TATAHEER TRADERS',
    address: '426- Ali Arcade, 13-km Main Multan Road, Lahore',
    phone: '+92(314)4094900',
    email: 'tataheertraders@gmail.com',
    tagline: 'Tataheer Business Group',
  })
  const [invoiceStart, setInvoiceStart] = useState(data.settings?.invoiceCounter || 201)

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>⚙️ <span>Settings</span></h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="section-box">
          <div className="section-title">🏢 Company Information</div>
          {Object.entries(companyForm).map(([key, val]) => (
            <div className="input-group" style={{ marginBottom: 12 }} key={key}>
              <label className="input-label">{key.charAt(0).toUpperCase() + key.slice(1)}</label>
              <input className="input" value={val} onChange={e => setCompanyForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <button className="btn btn-primary" onClick={() => toast.success('Company info saved!')}>Save Info</button>
        </div>

        <div className="section-box">
          <div className="section-title">🧾 Invoice Settings</div>
          <div className="input-group" style={{ marginBottom: 14 }}>
            <label className="input-label">Next Invoice Number</label>
            <input type="number" className="input" value={invoiceStart} onChange={e => setInvoiceStart(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => {
            updateNested('settings', 'invoiceCounter', parseInt(invoiceStart) || 201)
            toast.success('Invoice counter updated!')
          }}>Save</button>

          <div className="divider" />

          <div className="section-title" style={{ marginTop: 0 }}>📊 Data Management</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => {
              const backup = JSON.stringify(data, null, 2)
              const blob = new Blob([backup], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `tataheer-erp-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
              toast.success('Backup downloaded!')
            }}>📥 Export Backup (JSON)</button>
            <button className="btn btn-danger" onClick={() => {
              if (window.confirm('⚠️ This will CLEAR ALL DATA. Are you absolutely sure?')) {
                localStorage.removeItem('tataheer_erp_v1')
                toast.success('Data cleared. Refreshing...')
                setTimeout(() => window.location.reload(), 1000)
              }
            }}>🗑️ Reset All Data</button>
          </div>
        </div>
      </div>
    </div>
  )
}
