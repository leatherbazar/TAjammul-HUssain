import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, todayFmt } from './fmt'

// Company profiles — logo, address, tagline per company ID
const COMPANY_PROFILES = {
  TAT: {
    logoSrc: '/tataheer-invoice-logo.png',
    name: 'TATAHEER TRADERS',
    tagline: 'Tataheer Business Group',
    address: '426- Ali Arcade, 13-km Main Multan Road, Lahore',
    phone: '+92(314)4094900',
    email: 'tataheertraders@gmail.com',
  },
  INF: {
    logoSrc: '/logo-inf.png',
    name: 'INFINITY CORP',
    tagline: 'Infinity Corp',
    address: '101- Choudery Plaza Royal Park Lahore',
    phone: '+92-314-855-5566',
    email: 'infinity.crop512@gmail.com',
  },
}

function getProfile(company) {
  if (!company) return COMPANY_PROFILES.TAT
  return COMPANY_PROFILES[company.id] || {
    logoSrc: '/tataheer-invoice-logo.png',
    name: (company.name || '').toUpperCase(),
    tagline: company.name || '',
    address: company.address || '',
    phone: company.phone || '',
    email: company.email || '',
  }
}

// Table header color: dark charcoal
const TABLE_HEAD_COLOR = [30, 30, 40]

// ── PDF icon helpers ─────────────────────────────────────────────────────────
// Draw a map pin icon (filled teardrop)
function iconPin(doc, cx, cy) {
  const s = 1.5
  doc.setFillColor(210, 70, 20)
  doc.circle(cx, cy - s * 0.25, s * 0.58, 'F')
  // Downward triangle for the pin needle
  doc.lines(
    [[s * 0.52, 0], [-s * 0.26, s * 0.7], [-s * 0.26, -s * 0.7]],
    cx - s * 0.52, cy - s * 0.25, [1, 1], 'F', true
  )
  // White centre dot
  doc.setFillColor(255, 255, 255)
  doc.circle(cx, cy - s * 0.25, s * 0.21, 'F')
}

// Draw a mobile phone icon
function iconPhone(doc, cx, cy) {
  const s = 1.5
  doc.setFillColor(30, 155, 70)
  doc.roundedRect(cx - s * 0.38, cy - s * 0.58, s * 0.76, s * 1.16, s * 0.12, s * 0.12, 'F')
  doc.setFillColor(255, 255, 255)
  // Screen area
  doc.roundedRect(cx - s * 0.25, cy - s * 0.42, s * 0.5, s * 0.62, s * 0.05, s * 0.05, 'F')
  // Home button dot
  doc.circle(cx, cy + s * 0.42, s * 0.1, 'F')
}

// Draw an envelope icon
function iconEmail(doc, cx, cy) {
  const s = 1.5
  doc.setFillColor(50, 100, 210)
  doc.roundedRect(cx - s * 0.62, cy - s * 0.38, s * 1.24, s * 0.76, s * 0.08, s * 0.08, 'F')
  // White V-fold lines
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.5)
  doc.lines([[s * 0.62, s * 0.38]], cx - s * 0.62, cy - s * 0.38, [1, 1], 'S')
  doc.lines([[-s * 0.62, s * 0.38]], cx + s * 0.62, cy - s * 0.38, [1, 1], 'S')
  doc.setLineWidth(0.4)
}

function loadImg(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function addHeader(doc, title, docNumber, date, stealth = false, company = null) {
  const pageW = doc.internal.pageSize.getWidth()
  const profile = getProfile(company)

  // Header background
  doc.setFillColor(248, 248, 248)
  doc.rect(0, 0, pageW, 44, 'F')

  // Logo — exact size: 133mm × 18.7mm
  try {
    const img = await loadImg(profile.logoSrc)
    if (img) {
      doc.addImage(img, 'PNG', 8, 3, 133, 18.7)
    } else {
      throw new Error('logo not loaded')
    }
  } catch {
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 30, 30)
    doc.text(profile.name, 14, 16)
  }

  // Address + contact icons below logo
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80, 80, 80)

  // Address line with pin icon
  if (profile.address) {
    iconPin(doc, 10, 27)
    doc.text(profile.address, 14, 27)
  }

  // Phone + Email on same row with icons
  let icx = 14
  if (profile.phone) {
    iconPhone(doc, 10, 33)
    doc.setTextColor(80, 80, 80)
    doc.text(profile.phone, icx, 33)
    icx += doc.getTextWidth(profile.phone) + 10
  }
  if (profile.email) {
    iconEmail(doc, icx - 2, 33)
    doc.setTextColor(80, 80, 80)
    doc.text(profile.email, icx + 2, 33)
  }

  // Document title (right, dark red)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(120, 0, 0)
  doc.text(title, pageW - 12, 10, { align: 'right' })

  // Doc number & date
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  doc.text(`No: ${docNumber}`, pageW - 12, 20, { align: 'right' })
  doc.text(`Date: ${fmtDate(date) || todayFmt()}`, pageW - 12, 28, { align: 'right' })

  // Divider
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.4)
  doc.line(0, 44, pageW, 44)

  doc.setTextColor(0, 0, 0)
}

function addFooter(doc, company = null) {
  const profile = getProfile(company)
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const footerText = [profile.tagline, profile.email].filter(Boolean).join('  |  ')
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(12, 281, pageW - 12, 281)
    // Company tagline + email (left)
    doc.setFontSize(7.5)
    doc.setTextColor(160, 160, 160)
    if (footerText) doc.text(footerText, 12, 285)
    // Page number (right)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 12, 285, { align: 'right' })
    // System generated notice (centered)
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('System generated document. No signature and stamp required.', pageW / 2, 290, { align: 'center' })
  }
}

const headStyles = { fillColor: TABLE_HEAD_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 }
const bodyStyles = { fontSize: 8.5 }
const altStyles  = { fillColor: [245, 245, 248] }

export async function exportQuotationPDF(quotation, stealth = false, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'QUOTATION', quotation.number || 'DRAFT', quotation.date, stealth, company)

  let y = 50

  // Subject / Title row (if set)
  if (quotation.subject) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 30, 30)
    doc.text(`Subject: ${quotation.subject}`, 14, y)
    y += 8
    doc.setTextColor(40, 40, 40)
  }

  // Client info box
  doc.setFillColor(240, 240, 245)
  const qBoxH = [quotation.clientAddress, quotation.clientContact].filter(Boolean).length * 6 + 14
  doc.roundedRect(12, y, 186, qBoxH, 2, 2, 'F')
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(40, 40, 40)
  doc.text('Bill To:', 16, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.clientName || '—', 16, y + 12)
  let qBy = y + 12
  if (quotation.clientAddress) { qBy += 6; doc.text(quotation.clientAddress, 16, qBy) }
  if (quotation.clientContact) { qBy += 6; doc.text(`Tel: ${quotation.clientContact}`, 16, qBy) }
  y += qBoxH + 6

  const items = quotation.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  let srQ = 0
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        srQ++
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [srQ, item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
        bodyRows.push(row_)
      })
    } else {
      srQ++
      const row_ = [srQ, item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
      bodyRows.push(row_)
    }
  })

  const head = ['Sr', 'Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  if (!stealth) { head.push('Unit Price'); head.push('Amount') }

  autoTable(doc, { startY: y, head: [head], body: bodyRows, theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles, columnStyles: { 0: { cellWidth: 10, halign: 'center' } } })

  if (!stealth) {
    let finalY = doc.lastAutoTable.finalY + 10
    autoTable(doc, {
      startY: finalY,
      body: [
        ['Subtotal', `PKR ${(quotation.subtotal || 0).toLocaleString()}`],
        [`Tax (${quotation.taxRate || 0}%)`, `PKR ${(quotation.taxAmount || 0).toLocaleString()}`],
        ['TOTAL', `PKR ${(quotation.total || 0).toLocaleString()}`],
      ],
      theme: 'plain',
      columnStyles: { 0: { halign: 'right', fontStyle: 'bold' }, 1: { halign: 'right' } },
      tableWidth: 80, margin: { left: 120 }, bodyStyles: { fontSize: 9 },
    })
  }

  if (quotation.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFillColor(248, 248, 252)
    const noteLines = doc.splitTextToSize(quotation.notes, 178)
    const noteH = noteLines.length * 5 + 10
    doc.roundedRect(12, finalY, 186, noteH, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100)
    doc.text('Notes / Terms:', 16, finalY + 5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
    doc.text(noteLines, 16, finalY + 10)
  }

  addFooter(doc, company)
  doc.save(`Quotation-${quotation.number || 'Draft'}.pdf`)
}

export async function exportInvoicePDF(invoice, stealth = false, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'INVOICE', invoice.number, invoice.date, stealth, company)

  let y = 50

  // Subject / Title row (if set)
  if (invoice.subject) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(100, 30, 30)
    doc.text(`Subject: ${invoice.subject}`, 14, y)
    y += 8
    doc.setTextColor(40, 40, 40)
  }

  doc.setFillColor(240, 240, 245)
  const iBoxH = [invoice.clientAddress, invoice.clientContact].filter(Boolean).length * 6 + 14
  doc.roundedRect(12, y, 186, iBoxH, 2, 2, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
  doc.text('Bill To:', 16, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.clientName || '—', 16, y + 12)
  let iBy = y + 12
  if (invoice.clientAddress) { iBy += 6; doc.text(invoice.clientAddress, 16, iBy) }
  if (invoice.clientContact) { iBy += 6; doc.text(`Tel: ${invoice.clientContact}`, 16, iBy) }
  y += iBoxH + 6

  const items = invoice.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  let srI = 0
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        srI++
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [srI, item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
        bodyRows.push(row_)
      })
    } else {
      srI++
      const row_ = [srI, item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      if (!stealth) { row_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`); row_.push(`PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`) }
      bodyRows.push(row_)
    }
  })

  const head = ['Sr', 'Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  if (!stealth) { head.push('Unit Price'); head.push('Amount') }

  autoTable(doc, { startY: y, head: [head], body: bodyRows, theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles, columnStyles: { 0: { cellWidth: 10, halign: 'center' } } })

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
      tableWidth: 90, margin: { left: 110 }, bodyStyles: { fontSize: 9 },
    })
  }

  if (invoice.notes) {
    const noteY = doc.lastAutoTable.finalY + 8
    doc.setFillColor(248, 248, 252)
    const noteLines = doc.splitTextToSize(invoice.notes, 178)
    const noteH = noteLines.length * 5 + 10
    doc.roundedRect(12, noteY, 186, noteH, 2, 2, 'F')
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100)
    doc.text('Notes / Terms:', 16, noteY + 5)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
    doc.text(noteLines, 16, noteY + 10)
  }

  addFooter(doc, company)
  doc.save(`Invoice-${invoice.number}.pdf`)
}

export async function exportSupplyOrderPDF(order, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'SUPPLY ORDER', order.number || 'SO', order.date, false, company)

  let y = 50
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
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
    body: bodyRows, theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles,
    columnStyles: { 6: { cellWidth: 35 } },
  })

  if (order.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.notes, 30, finalY)
  }

  addFooter(doc, company)
  doc.save(`SupplyOrder-${order.number || 'SO'}.pdf`)
}

export async function exportDayBookPDF(entries, dateRange, company = null) {
  const doc = new jsPDF()
  const title = dateRange ? `DAY BOOK  (${dateRange})` : 'DAY BOOK'
  await addHeader(doc, title, 'STATEMENT', todayFmt(), false, company)

  const totalDebit  = entries.reduce((s, e) => s + (parseFloat(e.debit)  || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (parseFloat(e.credit) || 0), 0)
  const net = totalCredit - totalDebit

  autoTable(doc, {
    startY: 50,
    head: [['Date', 'Type', 'Description', 'Party', 'Reference', 'Wallet', 'Debit (Dr)', 'Credit (Cr)']],
    body: entries.map(e => [
      fmtDate(e.date),
      (e.type || '').replace(/-/g, ' '),
      e.description || '',
      e.partyName || '—',
      e.reference  || '—',
      e.wallet     || '',
      e.debit  ? `PKR ${Number(e.debit ).toLocaleString()}` : '—',
      e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—',
    ]),
    theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles,
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
    tableWidth: 90, margin: { left: 110 }, bodyStyles: { fontSize: 9 },
  })

  addFooter(doc, company)
  doc.save(`DayBook-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportLedgerPDF(contact, entries, company = null) {
  const doc = new jsPDF()
  const label = contact.accountHeadID ? `${contact.accountHeadID}` : 'ACC'
  await addHeader(doc, 'ACCOUNT STATEMENT', label, todayFmt(), false, company)

  let y = 50
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(12, y, 186, 20, 2, 2, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
  doc.text(contact.name || '—', 16, y + 7)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
  const details = [contact.phone, contact.email, contact.address].filter(Boolean).join('   |   ')
  if (details) doc.text(details, 16, y + 13)
  doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 100)
  doc.text(`Account ID: ${contact.accountHeadID || '—'}   Type: ${(contact.type || '').toUpperCase()}`, 130, y + 7)
  y += 26

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Description', 'Document Ref', 'Type', 'Debit (Dr)', 'Credit (Cr)', 'Balance']],
    body: entries.map(e => [
      fmtDate(e.date || (e.createdAt || '').slice(0, 10)),
      e.description || '',
      e.documentRef  || '—',
      (e.documentType || 'manual'),
      e.debit  ? `PKR ${Number(e.debit ).toLocaleString()}` : '—',
      e.credit ? `PKR ${Number(e.credit).toLocaleString()}` : '—',
      `PKR ${Number(e.balance || 0).toLocaleString()}`,
    ]),
    theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles,
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
    tableWidth: 90, margin: { left: 110 }, bodyStyles: { fontSize: 9 },
  })

  addFooter(doc, company)
  doc.save(`Ledger-${contact.accountHeadID || contact.name}-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportDeliveryNotePDF(note, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'DELIVERY NOTE', note.number, note.date, false, company)

  let y = 50
  const dnBoxH = [note.deliveryAddress, note.clientContact].filter(Boolean).length * 6 + 14
  doc.setFillColor(240, 240, 245)
  doc.roundedRect(12, y, 186, dnBoxH, 2, 2, 'F')
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
  doc.text('Deliver To:', 16, y + 6)
  doc.setFont('helvetica', 'normal')
  doc.text(note.clientName || '—', 16, y + 12)
  let dnBy = y + 12
  if (note.deliveryAddress) { dnBy += 6; doc.text(note.deliveryAddress, 16, dnBy) }
  if (note.clientContact) { dnBy += 6; doc.text(`Tel: ${note.clientContact}`, 16, dnBy) }
  y += dnBoxH + 6
  if (note.driverName || note.vehicleNo) { doc.setFontSize(9); doc.setTextColor(80,80,80); doc.text(`Driver: ${note.driverName || '—'}   Vehicle: ${note.vehicleNo || '—'}`, 14, y); y += 8 }

  const items = note.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)

  const bodyRows = []
  let srD = 0
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        srD++
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const row_ = [srD, item.description]
        if (hasColor)  row_.push(row.color || '—')
        if (hasMatrix) row_.push(sizeStr || '—')
        row_.push(total)
        row_.push(item.note || '')
        bodyRows.push(row_)
      })
    } else {
      srD++
      const row_ = [srD, item.description]
      if (hasColor)  row_.push(item.color || '')
      if (hasMatrix) row_.push('—')
      row_.push(item.qty || 0)
      row_.push(item.note || '')
      bodyRows.push(row_)
    }
  })

  const head = ['Sr', 'Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  head.push('Note')

  autoTable(doc, { startY: y, head: [head], body: bodyRows, theme: 'striped', headStyles, bodyStyles, alternateRowStyles: altStyles, columnStyles: { 0: { cellWidth: 10, halign: 'center' } } })

  if (note.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(note.notes, 30, finalY)
  }

  addFooter(doc, company)
  doc.save(`DeliveryNote-${note.number}.pdf`)
}
