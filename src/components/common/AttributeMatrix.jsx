import React, { useState } from 'react'

const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']
const COLOR_PRESETS = ['Black', 'White', 'Red', 'Blue', 'Navy', 'Green', 'Grey', 'Tan', 'Brown', 'Maroon', 'Custom...']

export default function AttributeMatrix({ rows = [], onChange, readOnly = false }) {
  const addRow = () => {
    const newRows = [...rows, { id: Date.now(), color: '', sizes: {}, note: '' }]
    onChange(newRows)
  }

  const removeRow = (id) => onChange(rows.filter(r => r.id !== id))

  const updateRow = (id, field, value) => {
    onChange(rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const updateSize = (id, size, value) => {
    onChange(rows.map(r => {
      if (r.id !== id) return r
      const sizes = { ...r.sizes, [size]: parseInt(value) || 0 }
      return { ...r, sizes }
    }))
  }

  const getRowTotal = (row) => Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
  const getGrandTotal = () => rows.reduce((sum, r) => sum + getRowTotal(r), 0)

  return (
    <div className="matrix-wrapper">
      <div className="matrix-table" style={{ minWidth: 820 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 60px 60px 60px 60px 60px 60px 60px 70px auto', gap: 4, padding: '8px 0', borderBottom: '2px solid rgba(220,38,38,0.3)', marginBottom: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', padding: '4px 6px' }}>COLOR</div>
          {SIZES.map(s => (
            <div key={s} style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textAlign: 'center', padding: '4px 2px' }}>{s}</div>
          ))}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textAlign: 'center' }}>TOTAL</div>
          {!readOnly && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}></div>}
        </div>

        {rows.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            No color/size variants added yet.
          </div>
        )}

        {rows.map(row => (
          <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '160px 60px 60px 60px 60px 60px 60px 60px 70px auto', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            {/* Color */}
            {readOnly ? (
              <div style={{ padding: '5px 8px', fontSize: 13, fontWeight: 600 }}>{row.color}</div>
            ) : (
              <select
                className="input"
                style={{ padding: '5px 8px', fontSize: 12 }}
                value={row.color}
                onChange={e => {
                  const val = e.target.value
                  if (val === 'Custom...') {
                    const custom = prompt('Enter custom color:')
                    if (custom) updateRow(row.id, 'color', custom)
                  } else {
                    updateRow(row.id, 'color', val)
                  }
                }}
              >
                <option value="">Select color</option>
                {COLOR_PRESETS.map(c => <option key={c}>{c}</option>)}
              </select>
            )}

            {/* Sizes */}
            {SIZES.map(size => (
              <div key={size} style={{ display: 'flex', justifyContent: 'center' }}>
                {readOnly ? (
                  <span style={{ fontSize: 13 }}>{row.sizes?.[size] || 0}</span>
                ) : (
                  <input
                    type="number"
                    className="size-input"
                    min="0"
                    value={row.sizes?.[size] || ''}
                    placeholder="0"
                    onChange={e => updateSize(row.id, size, e.target.value)}
                  />
                )}
              </div>
            ))}

            {/* Total */}
            <div style={{ textAlign: 'center' }}>
              <span className="total-badge">{getRowTotal(row)}</span>
            </div>

            {/* Delete */}
            {!readOnly && (
              <button
                className="btn btn-danger btn-xs"
                onClick={() => removeRow(row.id)}
                title="Remove row"
              >✕</button>
            )}
          </div>
        ))}

        {/* Grand Total Row */}
        {rows.length > 0 && (
          <div style={{ borderTop: '1px solid rgba(220,38,38,0.3)', marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>GRAND TOTAL:</span>
            <span className="total-badge" style={{ fontSize: 15, background: 'rgba(220,38,38,0.25)' }}>{getGrandTotal()}</span>
          </div>
        )}
      </div>

      {!readOnly && (
        <button className="btn btn-secondary btn-sm" style={{ marginTop: 10 }} onClick={addRow}>
          + Add Color Variant
        </button>
      )}
    </div>
  )
}

export { SIZES }
export function calcMatrixTotal(rows) {
  return rows.reduce((sum, r) => sum + Object.values(r.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0), 0)
}
