import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmtDate, todayFmt } from './fmt'

// ── Company profiles ─────────────────────────────────────────────────────────
const COMPANY_PROFILES = {
  TAT: {
    logoSrc: '/tataheer-invoice-logo.png',
    logoW: 120, logoH: 16.8,
    name: 'TATAHEER TRADERS',
    tagline: 'Tataheer Business Group — Your Trusted Partner',
    address: '426- Ali Arcade, 13-km Main Multan Road, Lahore',
    phone: '+92(314)4094900',
    email: 'tataheertraders@gmail.com',
    style: 'TAT',
    accent: [130, 0, 0],
    dark:   [100, 0, 0],
    light:  [255, 245, 245],
  },
  INF: {
    logoSrc: '/logo-inf.png',
    logoW: 108, logoH: 23,
    name: 'INFINITY CORP',
    tagline: 'Infinity Corp — Excellence in Every Step',
    address: '101- Choudery Plaza Royal Park Lahore',
    phone: '+92-314-855-5566',
    email: 'infinity.crop512@gmail.com',
    style: 'INF',
    accent: [0, 160, 220],    // sky blue / cyan (for total row)
    dark:   [18, 42, 100],    // deep navy (for table header + footer)
    titleColor: [0, 60, 160], // bold blue for title text
    light:  [240, 245, 255],
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
    style: 'TAT',
    accent: [130, 0, 0],
    dark:   [100, 0, 0],
    light:  [255, 245, 245],
  }
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

// ── TAT header: clean white + dark-red split ─────────────────────────────────
async function addHeaderTAT(doc, title, docNumber, date, profile) {
  const pageW = doc.internal.pageSize.getWidth()
  const [r, g, b] = profile.accent
  const [dr, dg, db] = profile.dark

  // White background
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, pageW, 46, 'F')

  // Left red accent strip
  doc.setFillColor(r, g, b)
  doc.rect(0, 0, 4, 46, 'F')

  // Right dark-red title block
  doc.setFillColor(dr, dg, db)
  doc.rect(pageW - 68, 0, 68, 46, 'F')

  // Logo (left side)
  try {
    const img = await loadImg(profile.logoSrc)
    if (img) {
      doc.addImage(img, 'PNG', 10, 14, profile.logoW, profile.logoH)
    } else throw new Error()
  } catch {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(r, g, b)
    doc.text(profile.name, 10, 20)
  }

  // Address + contact below logo
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(100, 100, 100)
  doc.text(profile.address || '', 10, 34)
  doc.text(`${profile.phone}   ${profile.email}`, 10, 40)

  // Document title (white on dark red)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(255, 255, 255)
  doc.text(title, pageW - 10, 15, { align: 'right' })

  // Doc No + Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(255, 210, 210)
  doc.text(`No: ${docNumber}`, pageW - 10, 27, { align: 'right' })
  doc.text(`Date: ${fmtDate(date) || todayFmt()}`, pageW - 10, 36, { align: 'right' })

  // Bottom divider in red
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.8)
  doc.line(0, 46, pageW, 46)

  doc.setTextColor(0, 0, 0)
}

// ── INF header: clean white — logo left, title right, diagonal divider ───────
async function addHeaderINF(doc, title, docNumber, date, profile) {
  const pageW = doc.internal.pageSize.getWidth()
  const titleBlue = profile.titleColor || [0, 60, 160]

  // Logo — large, directly on white background
  try {
    const img = await loadImg(profile.logoSrc)
    if (img) {
      doc.addImage(img, 'PNG', 12, 6, profile.logoW, profile.logoH)
    } else throw new Error()
  } catch {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.setTextColor(...titleBlue)
    doc.text(profile.name, 12, 26)
  }

  // Document title — bold blue, top-right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...titleBlue)
  doc.text(title, pageW - 12, 16, { align: 'right' })

  // Doc number — gray, right-aligned
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(`No: ${docNumber}`, pageW - 12, 24, { align: 'right' })

  // Date — left side below logo
  doc.setFontSize(8.5)
  doc.setTextColor(110, 110, 110)
  doc.text(`Date: ${fmtDate(date) || todayFmt()}`, 12, 37)

  // Diagonal divider — gray left segment fading into blue right segment
  const midX = pageW * 0.52
  const yLeft = 43, yMid = 41, yRight = 39

  doc.setDrawColor(190, 200, 210)
  doc.setLineWidth(0.7)
  doc.line(12, yLeft, midX, yMid)

  doc.setDrawColor(...(profile.titleColor || [0, 60, 160]))
  doc.setLineWidth(0.7)
  doc.line(midX, yMid, pageW - 12, yRight)

  doc.setTextColor(0, 0, 0)
}

// ── Unified header dispatcher ─────────────────────────────────────────────────
async function addHeader(doc, title, docNumber, date, _stealth = false, company = null) {
  const profile = getProfile(company)
  if (profile.style === 'INF') {
    await addHeaderINF(doc, title, docNumber, date, profile)
  } else {
    await addHeaderTAT(doc, title, docNumber, date, profile)
  }
}

// ── Footers ───────────────────────────────────────────────────────────────────
function addFooterTAT(doc, profile) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setDrawColor(200, 200, 200)
    doc.setLineWidth(0.3)
    doc.line(12, 281, pageW - 12, 281)
    doc.setFontSize(7.5)
    doc.setTextColor(160, 160, 160)
    doc.text([profile.tagline, profile.email].filter(Boolean).join('  |  '), 12, 285)
    doc.text(`Page ${i} of ${pageCount}`, pageW - 12, 285, { align: 'right' })
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('System generated document. No signature and stamp required.', pageW / 2, 290, { align: 'center' })
  }
}

function addFooterINF(doc, profile) {
  const pageCount = doc.internal.getNumberOfPages()
  const pageW = doc.internal.pageSize.getWidth()
  const [nr, ng, nb] = profile.dark

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)

    // System notice just above bar
    doc.setFontSize(6.5)
    doc.setTextColor(160, 160, 160)
    doc.text('System generated document. No signature and stamp required.', pageW / 2, 278, { align: 'center' })

    // Dark navy footer bar
    doc.setFillColor(nr, ng, nb)
    doc.rect(0, 281, pageW, 16, 'F')

    // Contact info — white text, left side
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    const info = [profile.address, profile.phone, profile.email].filter(Boolean).join('   |   ')
    doc.text(info, 12, 291)

    // Page number — right side
    doc.text(`Page ${i} of ${pageCount}`, pageW - 12, 291, { align: 'right' })
  }
}

function addFooter(doc, company = null) {
  const profile = getProfile(company)
  if (profile.style === 'INF') {
    addFooterINF(doc, profile)
  } else {
    addFooterTAT(doc, profile)
  }
}

// ── Table styles per company ──────────────────────────────────────────────────
function getTableStyles(company) {
  const profile = getProfile(company)
  if (profile.style === 'INF') {
    return {
      // Navy header rows, very-light-blue alternating rows (matching sample)
      headStyles: { fillColor: profile.dark, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8.5, textColor: [50, 50, 50] },
      alternateRowStyles: { fillColor: [237, 244, 252] },
    }
  }
  return {
    headStyles: { fillColor: profile.accent, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 245, 245] },
  }
}

// ── Client info box ───────────────────────────────────────────────────────────
function drawClientBox(doc, y, label, name, address, contact, company) {
  const profile = getProfile(company)
  const isINF = profile.style === 'INF'
  const barColor = isINF ? (profile.titleColor || [0, 60, 160]) : profile.accent
  const [r, g, b] = barColor

  const lines = [address, contact].filter(Boolean)
  const boxH = lines.length * 6 + 18

  // Gray background only for TAT; INF uses plain white with left bar only
  if (!isINF) {
    doc.setFillColor(245, 247, 252)
    doc.roundedRect(12, y, 186, boxH, 2, 2, 'F')
  }

  // Left accent bar
  doc.setFillColor(r, g, b)
  doc.rect(12, y, 3, boxH, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(r, g, b)
  doc.text(label, 19, y + 7)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(25, 25, 25)
  doc.text(name || '—', 19, y + 15)

  let ly = y + 15
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(80, 80, 80)
  if (address) { ly += 6; doc.text(address, 19, ly) }
  if (contact) { ly += 6; doc.text(`Tel: ${contact}`, 19, ly) }

  return boxH
}

// ── Total summary box ─────────────────────────────────────────────────────────
function drawTotals(doc, y, rows, company) {
  const profile = getProfile(company)
  const pageW = doc.internal.pageSize.getWidth()
  const isINF = profile.style === 'INF'

  // INF: sky-blue total row. TAT: accent-colored total row.
  const totalBg  = isINF ? profile.accent : profile.accent   // cyan for INF, red for TAT
  const totalTxt = [255, 255, 255]

  const boxX = pageW - 94
  const boxW = 88
  const rowH = 9

  // Light container behind all rows
  doc.setFillColor(245, 247, 250)
  doc.roundedRect(boxX - 2, y - 5, boxW + 2, rows.length * rowH + 4, 2, 2, 'F')

  rows.forEach((row, i) => {
    const isLast = i === rows.length - 1
    const ty = y + i * rowH

    if (isLast) {
      doc.setFillColor(...totalBg)
      doc.roundedRect(boxX - 2, ty - 6, boxW + 2, rowH + 2, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...totalTxt)
    } else {
      const isBold = row[0].includes('Tax') || row[0] === 'BALANCE' || row[0] === 'TOTAL DUE'
      doc.setFont('helvetica', isBold ? 'bold' : 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(60, 60, 60)
    }

    doc.text(row[0], pageW - 50, ty, { align: 'right' })
    doc.text(row[1], pageW - 12, ty, { align: 'right' })
  })
}

// ── Shared item-row builder ───────────────────────────────────────────────────
function buildItemRows(items, stealth) {
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)
  const bodyRows  = []
  let sr = 0

  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        sr++
        const total   = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const r_ = [sr, item.description]
        if (hasColor)  r_.push(row.color || '—')
        if (hasMatrix) r_.push(sizeStr || '—')
        r_.push(total)
        if (!stealth) {
          r_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`)
          r_.push(`PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`)
        }
        bodyRows.push(r_)
      })
    } else {
      sr++
      const r_ = [sr, item.description]
      if (hasColor)  r_.push(item.color || '')
      if (hasMatrix) r_.push('—')
      r_.push(item.qty || 0)
      if (!stealth) {
        r_.push(`PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`)
        r_.push(`PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`)
      }
      bodyRows.push(r_)
    }
  })

  const head = ['Sr', 'Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty')
  if (!stealth) { head.push('Unit Price'); head.push('Amount') }

  return { head, bodyRows }
}

// ── Notes box ────────────────────────────────────────────────────────────────
function drawNotesBox(doc, y, notes) {
  const lines = doc.splitTextToSize(notes, 178)
  const noteH = lines.length * 5 + 10
  doc.setFillColor(248, 248, 252)
  doc.roundedRect(12, y, 186, noteH, 2, 2, 'F')
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 80, 100)
  doc.text('Notes / Terms:', 16, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
  doc.text(lines, 16, y + 10)
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export async function exportQuotationPDF(quotation, stealth = false, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'QUOTATION', quotation.number || 'DRAFT', quotation.date, stealth, company)

  let y = 52

  if (quotation.subject) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 30, 30)
    doc.text(`Subject: ${quotation.subject}`, 14, y)
    y += 8
  }

  const boxH = drawClientBox(doc, y, 'BILL TO', quotation.clientName, quotation.clientAddress, quotation.clientContact, company)
  y += boxH + 6

  const { head, bodyRows } = buildItemRows(quotation.items || [], stealth)
  const ts = getTableStyles(company)
  autoTable(doc, {
    startY: y, head: [head], body: bodyRows, theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
  })

  if (!stealth) {
    const fy = doc.lastAutoTable.finalY + 10
    drawTotals(doc, fy, [
      ['Subtotal', `PKR ${(quotation.subtotal || 0).toLocaleString()}`],
      [`Tax (${quotation.taxRate || 0}%)`, `PKR ${(quotation.taxAmount || 0).toLocaleString()}`],
      ['TOTAL', `PKR ${(quotation.total || 0).toLocaleString()}`],
    ], company)
  }

  if (quotation.notes) {
    const ny = doc.lastAutoTable.finalY + (stealth ? 8 : 30)
    drawNotesBox(doc, ny, quotation.notes)
  }

  addFooter(doc, company)
  doc.save(`Quotation-${quotation.number || 'Draft'}.pdf`)
}

export async function exportInvoicePDF(invoice, stealth = false, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'INVOICE', invoice.number, invoice.date, stealth, company)

  let y = 52

  if (invoice.subject) {
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(80, 30, 30)
    doc.text(`Subject: ${invoice.subject}`, 14, y)
    y += 8
  }

  const boxH = drawClientBox(doc, y, 'BILL TO', invoice.clientName, invoice.clientAddress, invoice.clientContact, company)
  y += boxH + 6

  const { head, bodyRows } = buildItemRows(invoice.items || [], stealth)
  const ts = getTableStyles(company)
  autoTable(doc, {
    startY: y, head: [head], body: bodyRows, theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
  })

  if (!stealth) {
    const fy = doc.lastAutoTable.finalY + 10
    drawTotals(doc, fy, [
      ['Subtotal', `PKR ${(invoice.subtotal || 0).toLocaleString()}`],
      [`Tax (${invoice.taxRate || 0}%)`, `PKR ${(invoice.taxAmount || 0).toLocaleString()}`],
      ['TOTAL DUE', `PKR ${(invoice.total || 0).toLocaleString()}`],
      ['Advance Paid', `PKR ${(invoice.advancePaid || 0).toLocaleString()}`],
      ['BALANCE', `PKR ${((invoice.total || 0) - (invoice.advancePaid || 0)).toLocaleString()}`],
    ], company)
  }

  if (invoice.notes) {
    const ny = doc.lastAutoTable.finalY + (stealth ? 8 : 36)
    drawNotesBox(doc, ny, invoice.notes)
  }

  addFooter(doc, company)
  doc.save(`Invoice-${invoice.number}.pdf`)
}

export async function exportSupplyOrderPDF(order, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'SUPPLY ORDER', order.number || 'SO', order.date, false, company)

  let y = 52
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
  doc.text('Supplier:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${order.supplierName || '—'}   ${order.supplierContact || ''}`, 40, y)
  doc.text(`Priority: ${(order.priority || 'normal').toUpperCase()}   Status: ${order.status || 'pending'}`, 14, y + 6)
  if (order.assignedToName) doc.text(`Assigned To: ${order.assignedToName}`, 14, y + 12)
  y += 20

  // PDF shows ONLY purchase/cost price — selling price & profit are internal only
  const bodyRows = (order.items || []).map((item, i) => {
    const qty = item.qty || 0
    const cost = parseFloat(item.purchasePrice) || 0
    return [i + 1, item.description, item.color || '—', qty,
      cost ? `PKR ${cost.toLocaleString()}` : '—',
      cost ? `PKR ${(qty * cost).toLocaleString()}` : '—',
      item.note || '']
  })

  const ts = getTableStyles(company)
  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Color', 'Qty', 'Unit Price', 'Amount', 'Note']],
    body: bodyRows, theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: { 6: { cellWidth: 35 } },
  })

  // Total — purchase cost only
  const totalCost = (order.items || []).reduce((s, i) => s + (i.qty || 0) * (parseFloat(i.purchasePrice) || 0), 0)
  let ty = doc.lastAutoTable.finalY + 6
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
  if (totalCost > 0) doc.text(`Total Amount: PKR ${totalCost.toLocaleString()}`, 140, ty)

  if (order.notes) {
    const ny = ty + 8
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(40, 40, 40)
    doc.text('Notes:', 14, ny)
    doc.setFont('helvetica', 'normal')
    doc.text(order.notes, 30, ny)
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

  const ts = getTableStyles(company)
  autoTable(doc, {
    startY: 52,
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
    theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: {
      6: { halign: 'right', textColor: [180, 30, 30] },
      7: { halign: 'right', textColor: [20, 130, 60] },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 10
  drawTotals(doc, finalY, [
    ['Total Debit',  `PKR ${totalDebit .toLocaleString()}`],
    ['Total Credit', `PKR ${totalCredit.toLocaleString()}`],
    ['Net Balance',  `PKR ${Math.abs(net).toLocaleString()}  ${net >= 0 ? '(CR)' : '(DR)'}`],
  ], company)

  addFooter(doc, company)
  doc.save(`DayBook-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportLedgerPDF(contact, entries, company = null) {
  const doc = new jsPDF()
  const label = contact.accountHeadID ? `${contact.accountHeadID}` : 'ACC'
  await addHeader(doc, 'ACCOUNT STATEMENT', label, todayFmt(), false, company)

  let y = 52
  const boxH = drawClientBox(doc, y, 'ACCOUNT', contact.name,
    [contact.phone, contact.email, contact.address].filter(Boolean).join('   |   '),
    `ID: ${contact.accountHeadID || '—'}   Type: ${(contact.type || '').toUpperCase()}`, company)
  y += boxH + 6

  const ts = getTableStyles(company)
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
    theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: {
      4: { halign: 'right', textColor: [180, 30, 30] },
      5: { halign: 'right', textColor: [20, 130, 60] },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  })

  const finalY = doc.lastAutoTable.finalY + 10
  const totalDebit  = entries.reduce((s, e) => s + (e.debit  || 0), 0)
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0)
  const balance     = contact.currentBalance || 0
  drawTotals(doc, finalY, [
    ['Total Debit',     `PKR ${totalDebit .toLocaleString()}`],
    ['Total Credit',    `PKR ${totalCredit.toLocaleString()}`],
    ['Closing Balance', `PKR ${Math.abs(balance).toLocaleString()}  ${balance >= 0 ? '(Dr)' : '(Cr)'}`],
  ], company)

  addFooter(doc, company)
  doc.save(`Ledger-${contact.accountHeadID || contact.name}-${new Date().toISOString().slice(0,10)}.pdf`)
}

export async function exportDeliveryNotePDF(note, company = null) {
  const doc = new jsPDF()
  await addHeader(doc, 'DELIVERY NOTE', note.number, note.date, false, company)

  let y = 52
  const boxH = drawClientBox(doc, y, 'DELIVER TO', note.clientName, note.deliveryAddress, note.clientContact, company)
  y += boxH + 6

  if (note.driverName || note.vehicleNo) {
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80)
    doc.text(`Driver: ${note.driverName || '—'}   Vehicle: ${note.vehicleNo || '—'}`, 14, y)
    y += 8
  }

  const items = note.items || []
  const hasColor  = items.some(i => i.useMatrix ? (i.matrixRows || []).some(r => r.color) : !!i.color)
  const hasMatrix = items.some(i => i.useMatrix && (i.matrixRows || []).length > 0)
  const bodyRows = []
  let sr = 0
  items.forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        sr++
        const total   = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        const r_ = [sr, item.description]
        if (hasColor)  r_.push(row.color || '—')
        if (hasMatrix) r_.push(sizeStr || '—')
        r_.push(total); r_.push(item.note || '')
        bodyRows.push(r_)
      })
    } else {
      sr++
      const r_ = [sr, item.description]
      if (hasColor)  r_.push(item.color || '')
      if (hasMatrix) r_.push('—')
      r_.push(item.qty || 0); r_.push(item.note || '')
      bodyRows.push(r_)
    }
  })

  const head = ['Sr', 'Description']
  if (hasColor)  head.push('Color')
  if (hasMatrix) head.push('Sizes')
  head.push('Qty'); head.push('Note')

  const ts = getTableStyles(company)
  autoTable(doc, {
    startY: y, head: [head], body: bodyRows, theme: 'striped',
    headStyles: ts.headStyles, bodyStyles: ts.bodyStyles, alternateRowStyles: ts.alternateRowStyles,
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
  })

  if (note.notes) {
    const fy = doc.lastAutoTable.finalY + 8
    drawNotesBox(doc, fy, note.notes)
  }

  addFooter(doc, company)
  doc.save(`DeliveryNote-${note.number}.pdf`)
}
