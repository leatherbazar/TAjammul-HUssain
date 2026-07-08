export function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d)) return dateStr
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtCurrency(amount) {
  return Number(amount || 0).toLocaleString('en-PK', { minimumFractionDigits: 0 })
}

export function todayFmt() {
  return new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
}
