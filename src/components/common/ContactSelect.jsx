import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

/**
 * ContactSelect — searchable dropdown to pick a saved contact
 * Props:
 *   type: 'supplier' | 'client' | 'staff' | null (all)
 *   value: current text value
 *   onChange: (name, contact) => void  — contact is the full object or null if typed manually
 *   placeholder: string
 *   onContactSelect: (contact) => void  — called when a contact is selected, for auto-filling phone/email
 */
export default function ContactSelect({ type, value, onChange, placeholder, onContactSelect }) {
  const { data } = useApp()
  const contacts = (data.contacts || []).filter(c => !type || c.type === type)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const ref = useRef()

  // Sync external value changes
  useEffect(() => { setQuery(value || '') }, [value])

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = contacts.filter(c =>
    c.name?.toLowerCase().includes(query.toLowerCase()) ||
    c.accountCode?.toLowerCase().includes(query.toLowerCase()) ||
    c.phone?.includes(query)
  )

  const handleSelect = (contact) => {
    setQuery(contact.name)
    onChange(contact.name, contact)
    onContactSelect?.(contact)
    setOpen(false)
  }

  const handleInput = (e) => {
    setQuery(e.target.value)
    onChange(e.target.value, null)
    setOpen(true)
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
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Type or select...'}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'var(--bg2)', border: '1px solid var(--glass-border)',
          borderRadius: 8, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 2
        }}>
          {filtered.map(c => (
            <div
              key={c.id}
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
              {c.accountCode && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', background: 'var(--glass)', padding: '2px 6px', borderRadius: 4 }}>
                  {c.accountCode}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
