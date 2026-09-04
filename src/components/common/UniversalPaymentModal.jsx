import React, { useState, useMemo } from 'react'
import toast from 'react-hot-toast'

const WALLETS    = ['Cash', 'Bank', 'JazzCash', 'EasyPaisa', 'Cheque']
const WHT_PRESETS = [5, 10, 15, 20, 22]

/**
 * UniversalPaymentModal — three-tier split: Gross → Net (wallet) + WHT (Tax Head)
 *
 * Props:
 *  direction   'inbound'  = client pays us  (green theme)
 *              'outbound' = we pay supplier (amber theme)
 *  docNumber   invoice / purchase / account-head number
 *  partyName   client or supplier name
 *  total       document total (PKR)
 *  alreadyPaid amount already settled (PKR)
 *  apiEndpoint POST endpoint e.g. '/api/invoices/:id/payment'
 *  onClose / onSuccess
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
  const balance    = Math.max(total - alreadyPaid, 0)
  const isInbound  = direction === 'inbound'
  const accent     = isInbound ? 'var(--green)' : 'var(--amber)'
  const accentRgb  = isInbound ? '34,197,94'   : '245,158,11'

  // ── Tier 1: Gross ──────────────────────────────────────────────────────────
  const [grossStr, setGrossStr] = useState(String(balance))

  // ── Tier 3: WHT ────────────────────────────────────────────────────────────
  const [whtPct,     setWhtPct]     = useState(0)       // 0 = no WHT
  const [customMode, setCustomMode] = useState(false)
  const [whtManual,  setWhtManual]  = useState('')      // manual override

  // ── Tier 2: Net wallet ─────────────────────────────────────────────────────
  const [wallet,    setWallet]    = useState('Cash')
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState('')
  const [notes,     setNotes]     = useState('')
  const [saving,    setSaving]    = useState(false)

  // ── Derived values ─────────────────────────────────────────────────────────
  const gross = parseFloat(grossStr) || 0

  const whtAmount = useMemo(() => {
    if (whtPct === 0 && whtManual === '') return 0
    if (whtManual !== '') return Math.max(parseFloat(whtManual) || 0, 0)
    return parseFloat((gross * whtPct / 100).toFixed(2))
  }, [gross, whtPct, whtManual])

  const netAmount  = Math.max(gross - whtAmount, 0)
  const splitValid = Math.abs(netAmount + whtAmount - gross) < 0.01
  const balanceAfter = Math.max(balance - gross, 0)
  const isFullSettle = gross >= balance - 0.01 && balance > 0

  const handleWhtSelect = (pct) => {
    setWhtPct(pct); setCustomMode(false); setWhtManual('')
  }
  const handleCustomMode = () => {
    setCustomMode(true); setWhtPct(0); setWhtManual('')
  }

  const handleSave = async () => {
    if (!gross || gross <= 0)          { toast.error('Enter a valid gross amount.'); return }
    if (gross > balance + 0.01)        { toast.error(`Maximum is PKR ${balance.toLocaleString()}`); return }
    if (!splitValid)                   { toast.error('Net + WHT must equal Gross amount.'); return }
    setSaving(true)
    try {
      const res = await fetch(apiEndpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    gross,
          netAmount: netAmount,
          whtPct:    whtPct,
          whtAmount: whtAmount,
          wallet, date,
          reference: reference || '',
          notes:     notes || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Payment failed'); setSaving(false); return }
      const verb = isInbound ? 'received from' : 'paid to'
      toast.success(`PKR ${gross.toLocaleString()} ${verb} ${partyName}${whtAmount > 0 ? ` · WHT PKR ${whtAmount.toLocaleString()} → Tax Head` : ''}`)
      onSuccess(data)
    } catch { toast.error('Connection error.') }
    finally { setSaving(false) }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const tierBox = (extraStyle = {}) => ({
    borderRadius: 10,
    border: `1px solid rgba(${accentRgb},0.2)`,
    background: `rgba(${accentRgb},0.05)`,
    padding: '14px 16px',
    ...extraStyle,
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-title" style={{ color: accent, marginBottom: 6 }}>
          {isInbound ? '💰 Receive Payment' : '💳 Pay Supplier'} — {docNumber}
        </div>

        {/* ── Party / Balance bar ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, marginBottom: 16,
          padding: '8px 12px', borderRadius: 8,
          background: `rgba(${accentRgb},0.06)`, border: `1px solid rgba(${accentRgb},0.2)` }}>
          <span><span style={{ color: 'var(--text-muted)' }}>Party: </span><strong>{partyName}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Doc Total: </span><strong>PKR {Number(total).toLocaleString()}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Already Settled: </span><strong style={{ color: accent }}>PKR {Number(alreadyPaid).toLocaleString()}</strong></span>
          <span><span style={{ color: 'var(--text-muted)' }}>Balance Due: </span><strong style={{ color: 'var(--red)' }}>PKR {balance.toLocaleString()}</strong></span>
        </div>

        {/* ══════════════════════════════════════════════════════
            TIER 1 — GROSS SETTLEMENT AMOUNT
        ══════════════════════════════════════════════════════ */}
        <div style={tierBox({ marginBottom: 10 })}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
            Tier 1 — Gross Settlement Amount
          </div>
          <input
            type="number" className="input" autoFocus placeholder="0.00"
            style={{ fontWeight: 900, fontSize: 24, color: accent, borderColor: accent, marginBottom: 6 }}
            value={grossStr}
            onChange={e => { setGrossStr(e.target.value); setWhtManual('') }}
          />
          <div style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {isFullSettle && <span style={{ color: accent, fontWeight: 700 }}>✅ Full settlement — clears balance</span>}
            {gross > 0 && !isFullSettle && (
              <span style={{ color: 'var(--amber)' }}>
                ⏳ Partial — Balance after this entry: <strong>PKR {balanceAfter.toLocaleString()}</strong>
              </span>
            )}
            {gross > balance + 0.01 && (
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>❌ Exceeds balance due of PKR {balance.toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Arrow connector */}
        <div style={{ textAlign: 'center', fontSize: 18, color: 'var(--text-muted)', margin: '2px 0', lineHeight: 1 }}>↓ splits into ↓</div>

        {/* ══════════════════════════════════════════════════════
            TIER 2 + TIER 3 SIDE BY SIDE
        ══════════════════════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10, marginTop: 4 }}>

          {/* TIER 2 — NET AMOUNT → WALLET */}
          <div style={{
            borderRadius: 10, padding: '14px 16px',
            border: `1px solid ${isInbound ? 'rgba(34,197,94,0.35)' : 'rgba(245,158,11,0.35)'}`,
            background: `rgba(${accentRgb},0.07)`,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Tier 2 — Net {isInbound ? 'Received' : 'Paid'} → Wallet
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: accent, fontFamily: 'Orbitron,monospace', marginBottom: 10 }}>
              PKR {netAmount.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Actual cash {isInbound ? 'entering' : 'leaving'} the selected wallet
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {WALLETS.map(w => (
                <button key={w} onClick={() => setWallet(w)}
                  style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${wallet === w ? accent : 'var(--glass-border)'}`,
                    background: wallet === w ? `rgba(${accentRgb},0.2)` : 'transparent',
                    color: wallet === w ? accent : 'var(--text-muted)' }}>
                  {w}
                </button>
              ))}
            </div>
          </div>

          {/* TIER 3 — WHT TAX → TAX HEAD */}
          <div style={{
            borderRadius: 10, padding: '14px 16px',
            border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.06)',
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Tier 3 — Tax / WHT → Tax Head
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue)', fontFamily: 'Orbitron,monospace', marginBottom: 10 }}>
              PKR {whtAmount.toLocaleString()}
            </div>
            {/* WHT presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              <button onClick={() => handleWhtSelect(0)}
                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: whtPct === 0 && !customMode && whtManual === '' ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: 'var(--blue)' }}>None</button>
              {WHT_PRESETS.map(p => (
                <button key={p} onClick={() => handleWhtSelect(p)}
                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                    border: '1px solid rgba(99,102,241,0.4)',
                    background: !customMode && whtPct === p && p !== 0 ? 'rgba(99,102,241,0.25)' : 'transparent',
                    color: 'var(--blue)' }}>
                  {p}%
                </button>
              ))}
              <button onClick={handleCustomMode}
                style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                  border: '1px solid rgba(99,102,241,0.4)',
                  background: customMode ? 'rgba(99,102,241,0.25)' : 'transparent',
                  color: 'var(--blue)' }}>
                Custom
              </button>
            </div>
            {/* Custom input */}
            {customMode && (
              <input type="number" className="input" min={0} placeholder="PKR amount"
                style={{ borderColor: 'rgba(99,102,241,0.5)', fontSize: 13, marginBottom: 4 }}
                value={whtManual}
                onChange={e => setWhtManual(e.target.value)}
              />
            )}
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Auto-posted to Tax Head ledger
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            VALIDATION BAR — Net + WHT = Gross
        ══════════════════════════════════════════════════════ */}
        <div style={{
          padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          background: splitValid ? 'rgba(34,197,94,0.08)' : 'rgba(220,38,38,0.08)',
          border: `1px solid ${splitValid ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)'}`,
        }}>
          <span style={{ fontWeight: 700, color: splitValid ? 'var(--green)' : 'var(--red)' }}>
            {splitValid ? '✅ Split Validated' : '❌ Split Mismatch'}
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Net <strong style={{ color: accent }}>PKR {netAmount.toLocaleString()}</strong>
            {' '}+{' '}WHT <strong style={{ color: 'var(--blue)' }}>PKR {whtAmount.toLocaleString()}</strong>
            {' '}={' '}<strong style={{ color: splitValid ? 'var(--green)' : 'var(--red)' }}>PKR {(netAmount + whtAmount).toLocaleString()}</strong>
            {' '}/ Gross <strong>PKR {gross.toLocaleString()}</strong>
          </span>
          {gross > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              Balance after: <strong style={{ color: balanceAfter > 0 ? 'var(--amber)' : 'var(--green)' }}>
                PKR {balanceAfter.toLocaleString()}
              </strong>
            </span>
          )}
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

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ flex: 2, background: `rgba(${accentRgb},0.2)`, border: `1px solid ${accent}`, color: accent, fontWeight: 700 }}
            onClick={handleSave}
            disabled={saving || !splitValid || gross <= 0 || gross > balance + 0.01}>
            {saving
              ? '⏳ Processing…'
              : whtAmount > 0
              ? `${isInbound ? '💰 Receive' : '💳 Pay'} PKR ${gross.toLocaleString()} (Net ${netAmount.toLocaleString()} + WHT ${whtAmount.toLocaleString()})`
              : `${isInbound ? '💰 Receive' : '💳 Pay'} PKR ${gross.toLocaleString()} via ${wallet}`}
          </button>
        </div>

      </div>
    </div>
  )
}
