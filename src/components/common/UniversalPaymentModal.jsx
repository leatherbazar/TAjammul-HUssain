import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'

const WALLETS = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa', 'Cheque']
const WHT_PRESETS = [5, 10, 15, 20, 22]

/**
 * UniversalPaymentModal — single engine for both inbound (client) and outbound (vendor) payments.
 *
 * Props:
 *  direction   'inbound'  = client pays us  (green theme)
 *              'outbound' = we pay supplier (amber theme)
 *  docNumber   invoice / purchase number
 *  partyName   client name or supplier name
 *  total       document total (PKR)
 *  alreadyPaid amount already settled (PKR)
 *  apiEndpoint full path e.g. '/api/invoices/:id/payment'
 *  onClose     close handler
 *  onSuccess   (responseData) => void
 */
export default function UniversalPaymentModal({
  direction = 'inbound',
  docNumber,
  partyName,
  total = 0,
  alreadyPaid = 0,
  apiEndpoint,
  onClose,
  onSuccess,
}) {
  const balance = Math.max(total - alreadyPaid, 0)
  const isInbound = direction === 'inbound'
  const accent = isInbound ? 'var(--green)' : 'var(--amber)'
  const accentBg = isInbound ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)'
  const accentBorder = isInbound ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)'

  const [grossAmount, setGrossAmount] = useState(String(balance))
  const [wallet,      setWallet]      = useState('Cash')
  const [date,        setDate]        = useState(new Date().toISOString().slice(0, 10))
  const [reference,   setReference]   = useState('')
  const [notes,       setNotes]       = useState('')
  const [saving,      setSaving]      = useState(false)

  // WHT
  const [applyWHT,  setApplyWHT]  = useState(false)
  const [whtPct,    setWhtPct]    = useState(10)
  const [customWHT, setCustomWHT] = useState(false)
  const [whtManual, setWhtManual] = useState('')   // manual override of WHT amount

  const gross = parseFloat(grossAmount) || 0

  const whtAmount = useMemo(() => {
    if (!applyWHT) return 0
    if (whtManual !== '') return Math.max(parseFloat(whtManual) || 0, 0)
    return parseFloat((gross * whtPct / 100).toFixed(2))
  }, [applyWHT, gross, whtPct, whtManual])

  const netAmount = Math.max(gross - whtAmount, 0)

  const handleWhtPctSelect = (pct) => {
    setWhtPct(pct)
    setCustomWHT(false)
    setWhtManual('')
  }

  const handleSave = async () => {
    if (!gross || gross <= 0) { toast.error('Enter a valid amount.'); return }
    if (gross > balance + 0.01) { toast.error(`Maximum is PKR ${balance.toLocaleString()}`); return }
    setSaving(true)
    try {
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    gross,
          netAmount: applyWHT ? netAmount : gross,
          whtPct:    applyWHT ? whtPct : 0,
          whtAmount: applyWHT ? whtAmount : 0,
          wallet,
          date,
          reference: reference || '',
          notes:     notes || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Payment failed'); setSaving(false); return }
      const label = isInbound ? 'received from' : 'paid to'
      toast.success(`PKR ${gross.toLocaleString()} ${label} ${partyName} via ${wallet}${applyWHT ? ` · WHT PKR ${whtAmount.toLocaleString()}` : ''}`)
      onSuccess(data)
    } catch { toast.error('Connection error.') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>

        {/* Title */}
        <div className="modal-title" style={{ color: accent }}>
          {isInbound ? '💰 Receive Payment' : '💳 Pay Supplier'} — {docNumber}
        </div>

        {/* Summary bar */}
        <div style={{ padding: '10px 14px', borderRadius: 8, background: accentBg, border: `1px solid ${accentBorder}`, marginBottom: 14, fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span><span style={{ color: 'var(--text-muted)' }}>Party: </span><strong>{partyName}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Total: </span><strong>PKR {Number(total).toLocaleString()}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Paid: </span><strong style={{ color: accent }}>PKR {Number(alreadyPaid).toLocaleString()}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Balance: </span><strong style={{ color: 'var(--red)' }}>PKR {balance.toLocaleString()}</strong></span>
        </div>

        {/* Gross Amount */}
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">{isInbound ? 'Amount Received (PKR) *' : 'Amount Paying (PKR) *'}</label>
          <input
            type="number" className="input" autoFocus
            style={{ fontWeight: 900, fontSize: 22, color: accent, borderColor: accent }}
            value={grossAmount}
            onChange={e => { setGrossAmount(e.target.value); setWhtManual('') }}
            placeholder="0.00"
          />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            {gross >= balance && balance > 0 ? <span style={{ color: accent }}>✅ Full settlement</span>
              : gross > 0 ? <span style={{ color: 'var(--amber)' }}>Remaining after: PKR {(balance - gross).toLocaleString()}</span>
              : null}
          </div>
        </div>

        {/* ── WHT Section ── */}
        <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: applyWHT ? 12 : 0 }}>
            <input type="checkbox" checked={applyWHT} onChange={e => setApplyWHT(e.target.checked)} />
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue)' }}>🏛️ Apply Withholding Tax (WHT)</span>
          </label>

          {applyWHT && (
            <>
              {/* Preset buttons */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {WHT_PRESETS.map(p => (
                  <button key={p} onClick={() => handleWhtPctSelect(p)}
                    style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(99,102,241,0.5)',
                      background: !customWHT && whtPct === p ? 'rgba(99,102,241,0.3)' : 'transparent',
                      color: !customWHT && whtPct === p ? '#fff' : 'var(--blue)' }}>
                    {p}%
                  </button>
                ))}
                <button onClick={() => { setCustomWHT(true); setWhtManual('') }}
                  style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(99,102,241,0.5)',
                    background: customWHT ? 'rgba(99,102,241,0.3)' : 'transparent',
                    color: customWHT ? '#fff' : 'var(--blue)' }}>
                  Custom %
                </button>
                {customWHT && (
                  <input type="number" className="input" min={0} max={100} step={0.5}
                    style={{ width: 80, textAlign: 'center', borderColor: 'rgba(99,102,241,0.5)' }}
                    placeholder="%" autoFocus
                    onChange={e => { setWhtPct(parseFloat(e.target.value) || 0); setWhtManual('') }}
                  />
                )}
              </div>

              {/* WHT Amount + Breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 0 }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">WHT Amount (auto / editable)</label>
                  <input type="number" className="input" min={0}
                    style={{ borderColor: 'rgba(99,102,241,0.5)', fontWeight: 700 }}
                    value={whtManual !== '' ? whtManual : whtAmount.toFixed(2)}
                    onChange={e => setWhtManual(e.target.value)}
                  />
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Gross</span>
                    <span style={{ fontWeight: 700 }}>PKR {gross.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: 'var(--blue)' }}>WHT ({whtPct}%)</span>
                    <span style={{ fontWeight: 700, color: 'var(--blue)' }}>− PKR {whtAmount.toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(99,102,241,0.3)', paddingTop: 4 }}>
                    <span style={{ color: accent, fontWeight: 700 }}>Net {isInbound ? 'Received' : 'Paid'}</span>
                    <span style={{ fontWeight: 900, color: accent }}>PKR {netAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Wallet selector */}
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">{isInbound ? 'Received Into Wallet' : 'Paid From Wallet'}</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {WALLETS.map(w => (
              <button key={w} onClick={() => setWallet(w)}
                style={{ padding: '6px 14px', fontSize: 12, fontWeight: 700, borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${wallet === w ? accent : 'var(--glass-border)'}`,
                  background: wallet === w ? (isInbound ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)') : 'transparent',
                  color: wallet === w ? accent : 'var(--text-muted)' }}>
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Date + Reference + Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">Reference # (Cheque / TRN)</label>
            <input className="input" value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional" />
          </div>
          <div className="input-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label className="input-label">Notes</label>
            <input className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional remarks..." />
          </div>
        </div>

        {/* Net settlement reminder */}
        {applyWHT && (
          <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 14, fontSize: 12, color: 'var(--blue)' }}>
            📌 Gross PKR {gross.toLocaleString()} clears the balance. WHT PKR {whtAmount.toLocaleString()} posts to Tax Head. Net PKR {netAmount.toLocaleString()} hits <strong>{wallet}</strong>.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 2, background: isInbound ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', border: `1px solid ${accent}`, color: accent, fontWeight: 700 }}
            onClick={handleSave} disabled={saving}>
            {saving ? '⏳ Processing…'
              : applyWHT
              ? `${isInbound ? '💰 Receive' : '💳 Pay'} PKR ${gross.toLocaleString()} · WHT PKR ${whtAmount.toLocaleString()}`
              : `${isInbound ? '💰 Receive' : '💳 Pay'} PKR ${gross.toLocaleString()} via ${wallet}`}
          </button>
        </div>
      </div>
    </div>
  )
}
