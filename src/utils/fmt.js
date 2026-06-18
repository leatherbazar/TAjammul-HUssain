// Format a yyyy-mm-dd string to dd/mm/yyyy for display
export const fmtDate = (d) => {
  if (!d) return '—'
  const s = String(d).slice(0, 10)  // handle ISO timestamps too
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split('-').reverse().join('/')
  return s
}

// Today as dd/mm/yyyy
export const todayFmt = () => fmtDate(new Date().toISOString().slice(0, 10))
