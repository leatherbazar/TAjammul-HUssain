import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY = {
  name: 'TATAHEER TRADERS',
  tagline: 'Tataheer Business Group',
  address: '426- Ali Arcade, 13-km Main Multan Road, Lahore',
  phone: '+92(314)4094900',
  email: 'tataheertraders@gmail.com',
}

// Table header color: dark charcoal (no red)
const TABLE_HEAD_COLOR = [30, 30, 40]
const ACCENT_COLOR = [80, 0, 0]

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function addHeader(doc, title, docNumber, date, stealth = false) {
  const pageW = doc.internal.pageSize.getWidth() // 210mm for A4

  // White header background
  doc.setFillColor(248, 248, 248)
  doc.rect(0, 0, pageW, 44, 'F')

  // Logo — 20mm tall, proportional width (~77mm)
  try {
    const img = await loadImg('/tataheer-logo.png')
    if (img) {
      doc.addImage(img, 'PNG', 8, 3, 77, 20)
    }
  } catch (e) {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text('TATAHEER TRADERS', 14, 16)
  }

  // Company address below logo
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  doc.text(COMPANY.address, 8, 28)
  doc.text(`Tel: ${COMPANY.phone}   Email: ${COMPANY.email}`, 8, 34)

  // Document title (right side, dark red)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120, 0, 0)
  doc.text(title, pageW - 12, 12, { align: 'right' })

  // Doc number & date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`No: ${docNumber}`, pageW - 12, 22, { align: 'right' })
  doc.text(`Date: ${date || new Date().toLocaleDateString()}`, pageW - 12, 30, { align: 'right' })

  // Divider line
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.4)
  doc.line(0, 44, pageW, 44)

  doc.setTextColor(0, 0, 0)
}

function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(7.5)
    doc.setTextColor(160, 160, 160)
    doc.text(`${COMPANY.tagline}  |  ${COMPANY.email}`, 12, 289)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 12, 289, { align: 'right' })
    // Footer line
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(12, 285, pageW - 12, 285)
  }
}

const headStyles = { fillColor: TABLE_HEAD_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 }
const bodyStyles = { fontSize: 8.5 }
const altStyles = { fillColor: [245, 245, 248] }

export async function exportQuotationPDF(quotation, stealth = false) {
  const doc = new jsPDF()
  await addHeader(doc, 'QUOTATION', quotation.number || 'DRAFT', quotation.date, stealth)

  let y = 50

  // Client info box
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(12, y, 90, 20, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Bill To:', 16, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.clientName || '—', 16, y + 12)
  doc.text(quotation.clientContact || '', 16, y + 17)
  y += 26

  // Detect if any item has color or size matrix data
  const items = quotation.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
        bodyRows.push(row_)
      })
    } else {
      const row_ = [item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
      bodyRows.push(row_)
    }
  })

  const head = ['Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  if (!stealth) { head.push('Unit Price'); head.push('Amount') }

  autoTable(doc, {
    startY: y,
    head: [head],
    body: bodyRows,
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
  })

  if (!stealth) {
    let finalY = doc.lastAutoTable.finalY + 10
    const subtotal = quotation.subtotal || 0
    const taxAmt = quotation.taxAmount || 0
    const total = quotation.total || 0

    autoTable(doc, {
      startY: finalY,
      body: [
        ['Subtotal', `PKR ${subtotal.toLocaleString()}`],
        [`Tax (${quotation.taxRate || 0}%)`, `PKR ${taxAmt.toLocaleString()}`],
        ['TOTAL', `PKR ${total.toLocaleString()}`],
      ],
      theme: 'plain',
      columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
      tableWidth: 80,
      margin: { left: 120 },
      bodyStyles: { fontSize: 9 },
    })
  }

  if (quotation.notes) {
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(quotation.notes, 14, finalY + 5)
  }

  addFooter(doc)
  doc.save(`Quotation-${quotation.number || 'Draft'}.pdf`)
}

export async function exportInvoicePDF(invoice, stealth = false) {
  const doc = new jsPDF()
  await addHeader(doc, 'INVOICE', invoice.number, invoice.date, stealth)

  let y = 50
  // Client info box
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(12, y, 90, 16, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Bill To:', 16, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.clientName || '—', 16, y + 12)
  y += 22

  const items = invoice.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
        bodyRows.push(row_)
      })
    } else {
      const row_ = [item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
      bodyRows.push(row_)
    }
  })

  const head = ['Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  if (!stealth) { head.push('Unit Price'); head.push('Amount') }

  autoTable(doc, {
    startY: y,
    head: [head],
    body: bodyRows,
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
  })

  if (!stealth) {
    const finalY = doc.lastAutoTable.finalY + 8
    autoTable(doc, {
      startY: finalY,
      body: [
        ['Subtotal', `PKR ${(invoice.subtotal || 0).toLocaleString()}`],
        [`Tax (${invoice.taxRate || 0}%)`, `PKR ${(invoice.taxAmount || 0).toLocaleString()}`],
        ['TOTAL DUE', `PKR ${(invoice.total || 0).toLocaleString()}`],
        ['Advance Paid', `PKR ${(invoice.advancePaid || 0).toLocaleString()}`],
        ['BALANCE', `PKR ${((invoice.total || 0) - (invoice.advancePaid || 0)).toLocaleString()}`],
      ],
      theme: 'plain',
      columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
      tableWidth: 90,
      margin: { left: 110 },
      bodyStyles: { fontSize: 9 },
    })
  }

  addFooter(doc)
  doc.save(`Invoice-${invoice.number}.pdf`)
}

export async function exportSupplyOrderPDF(order) {
  const doc = new jsPDF()
  await addHeader(doc, 'SUPPLY ORDER', order.number || 'SO', order.date)

  let y = 50
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Supplier:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${order.supplierName || '—'}   ${order.supplierContact || ''}`, 40, y)
  doc.text(`Priority: ${(order.priority || 'normal').toUpperCase()}   Status: ${order.status || 'pending'}`, 14, y + 6)
  if (order.assignedToName) doc.text(`Assigned To: ${order.assignedToName}`, 14, y + 12)
  y += 20

  const bodyRows = (order.items || []).map((item, i) => {
    const qty = item.qty || 0
    const price = parseFloat(item.marketPrice) || 0
    return [i + 1, item.description, item.color || '—', qty,
      price ? `PKR ${price.toLocaleString()}` : '—',
      price ? `PKR ${(qty * price).toLocaleString()}` : '—',
      item.note || '']
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Color', 'Qty', 'Market Price', 'Amount', 'Field Note']],
    body: bodyRows,
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
    columnStyles: { 6: { cellWidth: 35 } },
  })

  if (order.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.notes, 30, finalY)
  }

  addFooter(doc)
  doc.save(`SupplyOrder-${order.number || 'SO'}.pdf`)
}

export async function exportDayBookPDF(entries, dateRange) {
  const doc = new jsPDF()
  const title = dateRange ? `DAY BOOK  (${dateRange})` : 'DAY BOOK'
  await addHeader(doc, title, 'STATEMENT', new Date().toLocaleDateString())

  const totalDebit  = entries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const net = totalCredit - totalDebit

  autoTable(doc, {
    startY: 50,
    head: [['Date', 'Type', 'Description', 'Party', 'Reference', 'Wallet', 'Debit (Dr)', 'Credit (Cr)']],
    body: entries.map(e => [
      e.date || '',
      (e.type || '').replace(/-/g, ' '),
      e.description || '',
      e.partyName || '—',
      e.reference  || '—',
      e.wallet     || '',
      e.debit  ? `PKR ${Number(e.debit ).toLocaleString()}` : '—',
      e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—',
    ]),
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
    columnStyles: {
      6: { halign: 'right', textColor: [180, 30, 30] },
      7: { halign: 'right', textColor: [20, 130, 60] },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 8
  autoTable(doc, {
    startY: finalY,
    body: [
      ['Total Debit',  `PKR ${totalDebit .toLocaleString()}`],
      ['Total Credit', `PKR ${totalCredit.toLocaleString()}`],
      ['Net Balance',  `PKR ${Math.abs(net).toLocaleString()}  ${net >= 0 ? '(CR)' : '(DR)'}`],
    ],
    theme: 'plain',
    columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
    tableWidth: 90,
    margin: { left: 110 },
    bodyStyles: { fontSize: 9 },
  })

  addFooter(doc)
  doc.save(`DayBook-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportLedgerPDF(contact, entries) {
  const doc = new jsPDF()
  const label = contact.accountHeadID ? `${contact.accountHeadID}` : 'ACC'
  await addHeader(doc, 'ACCOUNT STATEMENT', label, new Date().toLocaleDateString())

  let y = 50
  // Contact info box
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(12, y, 186, 20, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text(contact.name || '—', 16, y + 7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)
  const details = [contact.phone, contact.email, contact.address].filter(Boolean).join('   |   ')
  if (details) doc.text(details, 16, y + 13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 100)
  doc.text(`Account ID: ${contact.accountHeadID || '—'}   Type: ${(contact.type || '').toUpperCase()}`, 130, y + 7)
  y += 26

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Document Ref', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
    body: entries.map(e => [
      e.date || (e.createdAt || '').slice(0, 10) || '',
      e.description || '',
      e.documentRef  || '—',
      (e.documentType || 'manual'),
      e.debit  ? `PKR ${Number(e.debit ).toLocaleString()}` : '—',
      e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—',
      `PKR ${Number(e.balance || 0).toLocaleString()}`,
    ]),
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
    columnStyles: {
      4: { halign: 'right', textColor: [180, 30, 30] },
      5: { halign: 'right', textColor: [20, 130, 60] },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 8
  const totalDebit  = entries.reduce((s, e) => s + (e.debit  || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0)
  const balance     = contact.currentBalance || 0

  autoTable(doc, {
    startY: finalY,
    body: [
      ['Total Debit',      `PKR ${totalDebit .toLocaleString()}`],
      ['Total Credit',     `PKR ${totalCredit.toLocaleString()}`],
      ['Closing Balance',  `PKR ${Math.abs(balance).toLocaleString()}  ${balance >= 0 ? '(Dr)' : '(Cr)'}`],
    ],
    theme: 'plain',
    columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
    tableWidth: 90,
    margin: { left: 110 },
    bodyStyles: { fontSize: 9 },
  })

  addFooter(doc)
  doc.save(`Ledger-${contact.accountHeadID || contact.name}-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportDeliveryNotePDF(note) {
  const doc = new jsPDF()
  await addHeader(doc, 'DELIVERY NOTE', note.number, note.date)

  let y = 50
  // Delivery info row
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('To:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${note.clientName || '—'}   ${note.clientContact || ''}`, 24, y)
  if (note.deliveryAddress) {
    y += 6
    doc.text(`Address: ${note.deliveryAddress}`, 14, y)
  }
  if (note.driverName || note.vehicleNo) {
    y += 6
    doc.text(`Driver: ${note.driverName || '—'}   Vehicle: ${note.vehicleNo || '—'}`, 14, y)
  }
  y += 12

  const items = note.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        row_.push(item.note || '')
        bodyRows.push(row_)
      })
    } else {
      const row_ = [item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      row_.push(item.note || '')
      bodyRows.push(row_)
    }
  })

  const head = ['Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  head.push('Note')

  autoTable(doc, {
    startY: y,
    head: [head],
    body: bodyRows,
    theme: 'striped',
    headStyles,
    bodyStyles,
    alternateRowStyles: altStyles,
  })

  if (note.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(note.notes, 30, finalY)
  }

  addFooter(doc)
  doc.save(`DeliveryNote-${note.number}.pdf`)
}
