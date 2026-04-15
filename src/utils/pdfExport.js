import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const COMPANY = {
  name: 'TATAHEER TRADERS',
  tagline: 'Tataheer Business Group',
  address: '426- Ali Arcade, 13-km Main Multan Road, Lahore',
  phone: '+92(314)4094900',
  email: 'tataheertraders@gmail.com',
}

function addHeader(doc, title, docNumber, date, stealth = false) {
  doc.setFillColor(139, 0, 0)
  doc.rect(0, 0, 210, 32, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('TATAHEER TRADERS', 14, 12)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(COMPANY.address, 14, 18)
  doc.text(`Tel: ${COMPANY.phone}  |  Email: ${COMPANY.email}`, 14, 23)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 210 - 14, 12, { align: 'right' })
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`#${docNumber}`, 210 - 14, 18, { align: 'right' })
  doc.text(`Date: ${date || new Date().toLocaleDateString()}`, 210 - 14, 23, { align: 'right' })
  doc.setTextColor(0, 0, 0)
  if (!stealth) {
    doc.setDrawColor(139, 0, 0)
    doc.setLineWidth(0.5)
    doc.line(0, 32, 210, 32)
  }
}

function addFooter(doc, stealth = false) {
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Tataheer Business Group — tataheertraders@gmail.com', 14, 290)
    doc.text(`Page ${i} of ${pageCount}`, 210 - 14, 290, { align: 'right' })
  }
}

export function exportQuotationPDF(quotation, stealth = false) {
  const doc = new jsPDF()
  addHeader(doc, 'QUOTATION', quotation.number || 'DRAFT', quotation.date, stealth)

  let y = 40

  // Client info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(quotation.clientName || '—', 14, y + 5)
  doc.text(quotation.clientContact || '', 14, y + 10)
  y += 20

  // Items table
  const bodyRows = []
  ;(quotation.items || []).forEach(item => {
    if (item.useMatrix && item.matrixRows?.length) {
      item.matrixRows.forEach(row => {
        const total = Object.values(row.sizes || {}).reduce((a, b) => a + (parseInt(b) || 0), 0)
        const sizeStr = Object.entries(row.sizes || {}).filter(([, v]) => v > 0).map(([k, v]) => `${k}:${v}`).join(', ')
        bodyRows.push([
          item.description,
          row.color,
          sizeStr,
          total,
          stealth ? '' : `PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`,
          stealth ? '' : `PKR ${(total * parseFloat(item.unitPrice || 0)).toLocaleString()}`
        ])
      })
    } else {
      bodyRows.push([
        item.description,
        item.color || '—',
        'One Size',
        item.qty || 0,
        stealth ? '' : `PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`,
        stealth ? '' : `PKR ${((item.qty || 0) * parseFloat(item.unitPrice || 0)).toLocaleString()}`
      ])
    }
  })

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Color', 'Sizes', 'Qty', ...(stealth ? [] : ['Unit Price', 'Amount'])]],
    body: bodyRows,
    theme: 'striped',
    headStyles: { fillColor: [139, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [250, 248, 248] },
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
      didDrawCell: (data) => {
        if (data.row.index === 2) {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
        }
      }
    })
  }

  if (quotation.notes) {
    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(quotation.notes, 14, finalY + 5)
  }

  addFooter(doc, stealth)
  doc.save(`Quotation-${quotation.number || 'Draft'}.pdf`)
}

export function exportInvoicePDF(invoice, stealth = false) {
  const doc = new jsPDF()
  addHeader(doc, 'INVOICE', invoice.number, invoice.date, stealth)

  let y = 40
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Bill To:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.clientName || '—', 14, y + 5)
  y += 18

  const bodyRows = (invoice.items || []).map(item => [
    item.description,
    item.qty,
    stealth ? '' : `PKR ${parseFloat(item.unitPrice || 0).toLocaleString()}`,
    stealth ? '' : `PKR ${(item.qty * parseFloat(item.unitPrice || 0)).toLocaleString()}`
  ])

  autoTable(doc, {
    startY: y,
    head: [['Description', 'Qty', ...(stealth ? [] : ['Unit Price', 'Amount'])]],
    body: bodyRows,
    theme: 'striped',
    headStyles: { fillColor: [139, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
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
      tableWidth: 90, margin: { left: 110 },
      bodyStyles: { fontSize: 9 },
    })
  }

  addFooter(doc, stealth)
  doc.save(`Invoice-${invoice.number}.pdf`)
}

export function exportSupplyOrderPDF(order) {
  const doc = new jsPDF()
  addHeader(doc, 'SUPPLY ORDER', order.number || 'SO', order.date)

  let y = 40
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Supplier:', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.text(`${order.supplierName || '—'}  |  ${order.supplierContact || ''}`, 40, y)
  doc.text(`Priority: ${(order.priority || 'normal').toUpperCase()}  |  Status: ${order.status || 'pending'}`, 14, y + 6)
  if (order.assignedToName) doc.text(`Assigned To: ${order.assignedToName}`, 14, y + 12)
  y += 20

  const bodyRows = (order.items || []).map((item, i) => {
    const qty = item.qty || 0
    const price = parseFloat(item.marketPrice) || 0
    return [i + 1, item.description, item.color || '—', qty, price ? `PKR ${price.toLocaleString()}` : '—', price ? `PKR ${(qty * price).toLocaleString()}` : '—', item.note || '']
  })

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Color', 'Qty', 'Market Price', 'Amount', 'Field Note']],
    body: bodyRows,
    theme: 'striped',
    headStyles: { fillColor: [139, 0, 0], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    columnStyles: { 6: { cellWidth: 35 } },
  })

  if (order.notes) {
    const finalY = doc.lastAutoTable.finalY + 8
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 14, finalY)
    doc.setFont('helvetica', 'normal')
    doc.text(order.notes, 30, finalY)
  }

  addFooter(doc)
  doc.save(`SupplyOrder-${order.number || 'SO'}.pdf`)
}

export function exportDeliveryNotePDF(note) {
  const doc = new jsPDF()
  addHeader(doc, 'DELIVERY NOTE', note.number, note.date)

  autoTable(doc, {
    startY: 42,
    head: [['Item', 'Color', 'Size Breakdown', 'Total Qty']],
    body: (note.items || []).map(item => [
      item.description,
      item.color || '—',
      item.sizeBreakdown || '—',
      item.qty
    ]),
    theme: 'striped',
    headStyles: { fillColor: [139, 0, 0], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
  })

  addFooter(doc)
  doc.save(`DeliveryNote-${note.number}.pdf`)
}
