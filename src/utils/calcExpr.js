/**
 * Safe math expression evaluator.
 * Supports: + - * / ( )
 * Examples: "1+5" → 6, "100-75" → 25, "12*5" → 60, "200/4" → 50
 * Returns the original string if expression is invalid or not a formula.
 */
export function calcExpr(raw) {
  if (raw === undefined || raw === null) return ''
  const str = String(raw).trim()
  if (!str) return ''

  // If it's just a plain number, return as-is
  if (/^[\d.]+$/.test(str)) return str

  // Only allow safe characters: digits, operators, dots, spaces, parentheses
  if (!/^[\d\s+\-*/().]+$/.test(str)) return str

  try {
    // eslint-disable-next-line no-new-func
    const result = Function('"use strict"; return (' + str + ')')()
    if (typeof result !== 'number' || !isFinite(result)) return str
    // Return integer if result has no decimals, else 2dp
    return result % 1 === 0 ? String(result) : result.toFixed(2)
  } catch {
    return str
  }
}
