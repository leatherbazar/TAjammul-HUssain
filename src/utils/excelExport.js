import * as XLSX from 'xlsx'

export function exportToExcel(data, sheetName, fileName) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

export function exportQuotationExcel(quotation) {
  const rows = []
  ;(quotation.items || []).forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        rows.push({
          Description: item.description,
          Color: row.color,
          S: row.sizes?.S || 0,
          M: row.sizes?.M || 0,
          L: row.sizes?.L || 0,
          XL: row.sizes?.XL || 0,
          '2XL': row.sizes?.['2XL'] || 0,
          '3XL': row.sizes?.['3XL'] || 0,
          '4XL': row.sizes?.['4XL'] || 0,
          'Total Qty': total,
          'Unit Price': item.unitPrice || 0,
          'Amount': total * (item.unitPrice || 0),
        })
      })
    } else {
      rows.push({
        Description: item.description,
        Color: item.color || '',
        S: '', M: '', L: '', XL: '', '2XL': '', '3XL': '', '4XL': '',
        'Total Qty': item.qty || 0,
        'Unit Price': item.unitPrice || 0,
        'Amount': (item.qty || 0) * (item.unitPrice || 0),
      })
    }
  })
  rows.push({})
  rows.push({ Description: 'Subtotal', 'Amount': quotation.subtotal || 0 })
  rows.push({ Description: `Tax (${quotation.taxRate || 0}%)`, 'Amount': quotation.taxAmount || 0 })
  rows.push({ Description: 'TOTAL', 'Amount': quotation.total || 0 })

  exportToExcel(rows, 'Quotation', `Quotation-${quotation.number || 'Draft'}`)
}

export function exportInventoryExcel(inventory) {
  const rows = inventory.flatMap(item =>
    (item.matrixRows || [{ color: item.color || 'N/A', sizes: {} }]).map(row => ({
      SKU: item.sku || item.id,
      Description: item.name,
      Color: row.color,
      S: row.sizes?.S || 0,
      M: row.sizes?.M || 0,
      L: row.sizes?.L || 0,
      XL: row.sizes?.XL || 0,
      '2XL': row.sizes?.['2XL'] || 0,
      '3XL': row.sizes?.['3XL'] || 0,
      '4XL': row.sizes?.['4XL'] || 0,
      'Total Stock': Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0),
      Category: item.category || '',
      'Cost Price': item.costPrice || 0,
      'Sell Price': item.sellPrice || 0,
    }))
  )
  exportToExcel(rows, 'Inventory', 'Tataheer-Inventory')
}

export function exportDayBookExcel(entries) {
  const rows = entries.map(e => ({
    Date: e.date,
    Type: e.type,
    Description: e.description,
    Debit: e.debit || 0,
    Credit: e.credit || 0,
    Balance: e.balance || 0,
    Wallet: e.wallet || '',
    Reference: e.reference || '',
  }))
  exportToExcel(rows, 'Day Book', 'Tataheer-DayBook')
}
