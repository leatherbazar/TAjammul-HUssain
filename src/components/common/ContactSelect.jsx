import React, { useState, useRef, useEffect, useCallback } from 'react'

/**
 * ContactSelect — live-search dropdown against /api/contacts/search
 * Props:
 *   type: 'supplier' | 'client' | 'staff' | null (all)
 *   value: current text value
 *   onChange: (name, contact) => void
 *   onContactSelect: (contact) => void  — auto-fill phone/email/accountHeadID
 *   placeholder: string
 */
export default function ContactSelect({ type, value, onChange, placeholder, onContactSelect }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const ref = useRef()
  const debounceRef = useRef()

  // Sync external value
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q) => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      if (!q || q.length < 1) { setResults([]); return }
      setLoading(true)
      try {
        const params = new URLSearchParams({ q })
        if (type) params.append('type', type)
        const res = await fetch(`/api/contacts/search?${params}`)
        const data = await res.json()
        setResults(data.contacts || [])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 200)
  }, [type])

  const handleInput = (e) => {
    const val = e.target.value
    setQuery(val)
    onChange(val, null)
    setOpen(true)
    search(val)
  }

  const handleFocus = () => {
    setOpen(true)
    if (!results.length) search(query || '')
  }

  const handleSelect = (contact) => {
    setQuery(contact.name)
    onChange(contact.name, contact)
    onContactSelect?.(contact)
    setOpen(false)
    setResults([])
  }

  const typeColor = {
    supplier: 'var(--amber)',
    client: 'var(--green)',
    staff: 'var(--blue)',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        className="input"
        value={query}
        onChange={handleInput}
        onFocus={handleFocus}
        placeholder={placeholder || 'Type or select...'}
        autoComplete="off"
      />

      {open && (results.length > 0 || loading) && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--bg2)', border: '1px solid var(--glass-border)',
          borderRadius: 8, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 2
        }}>
          {loading && (
            <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-muted)' }}>Searching...</div>
          )}
          {results.map(c => (
            <div
              key={c._id || c.id}
              onMouseDown={() => handleSelect(c)}
              style={{
                padding: '8px 12px', cursor: 'pointer', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid var(--glass-border)',
                transition: 'background 0.15s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--glass)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: typeColor[c.type] || 'var(--text)' }}>
                  {c.name}
                </div>
                {c.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                {c.accountHeadID && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--glass)', padding: '2px 6px', borderRadius: 4 }}>
                    {c.accountHeadID}
                  </span>
                )}
                {c.currentBalance !== undefined && (
                  <div style={{ fontSize: 10, color: c.currentBalance >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                    Bal: PKR {Number(c.currentBalance).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
