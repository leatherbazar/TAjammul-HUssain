const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, Header, Footer, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require('docx');
const fs = require('fs');

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  darkBlue:  '1B2A4A',
  midBlue:   '2E5FA3',
  lightBlue: 'D6E4F7',
  amber:     'C97B00',
  green:     '1A7A3C',
  white:     'FFFFFF',
  lightGray: 'F2F4F8',
  medGray:   'D0D5DD',
  textDark:  '1C1C1C',
  red:       'B91C1C',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const border = (color = C.medGray, sz = 4) => ({ style: BorderStyle.SINGLE, size: sz, color });
const cellBorders = (color = C.medGray) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: 'FFFFFF' });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });
const cellPad = { top: 100, bottom: 100, left: 140, right: 140 };
const cellPadSm = { top: 70, bottom: 70, left: 120, right: 120 };

const sp = (before = 0, after = 0) => ({ spacing: { before, after } });

function txt(text, opts = {}) {
  return new TextRun({ text: String(text), font: 'Calibri', ...opts });
}

function para(children, opts = {}) {
  if (typeof children === 'string') children = [txt(children)];
  return new Paragraph({ children, ...opts });
}

function h1(text, bookmark) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    ...sp(320, 120),
    children: [new TextRun({ text, font: 'Calibri', size: 32, bold: true, color: C.darkBlue })],
    ...(bookmark ? { bookmark } : {}),
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    ...sp(240, 80),
    children: [new TextRun({ text, font: 'Calibri', size: 26, bold: true, color: C.midBlue })],
  });
}

function h3(text) {
  return new Paragraph({
    ...sp(180, 60),
    children: [new TextRun({ text, font: 'Calibri', size: 22, bold: true, color: C.darkBlue })],
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'bullets', level },
    ...sp(40, 40),
    children: [txt(text, { size: 20 })],
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.midBlue, space: 1 } },
    ...sp(160, 160),
    children: [],
  });
}

function pb() { return new Paragraph({ children: [new PageBreak()] }); }

function bodyPara(text, opts = {}) {
  return new Paragraph({
    ...sp(60, 60),
    children: [txt(text, { size: 20, ...opts })],
  });
}

function codePara(text) {
  return new Paragraph({
    ...sp(40, 40),
    indent: { left: 720 },
    children: [txt(text, { size: 18, font: 'Courier New', color: C.midBlue })],
  });
}

// ── Table helpers ─────────────────────────────────────────────────────────────
const CONTENT_W = 9360; // US Letter 1" margins

function headerCell(text, w, color = C.darkBlue) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: cellBorders(C.medGray),
    shading: { fill: color, type: ShadingType.CLEAR },
    margins: cellPadSm,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [txt(text, { bold: true, size: 18, color: C.white })],
    })],
  });
}

function dataCell(text, w, opts = {}) {
  const { color = C.textDark, bg = null, bold = false, center = false } = opts;
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders: cellBorders(C.medGray),
    shading: bg ? { fill: bg, type: ShadingType.CLEAR } : undefined,
    margins: cellPadSm,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [txt(text, { size: 18, color, bold })],
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => headerCell(h, colWidths[i])),
      }),
      ...rows.map((row, ri) => new TableRow({
        children: row.map((cell, ci) => {
          const bg = ri % 2 === 0 ? C.lightGray : C.white;
          if (typeof cell === 'string') return dataCell(cell, colWidths[ci], { bg });
          return dataCell(cell.text, colWidths[ci], { bg, ...cell });
        }),
      })),
    ],
  });
}

// ── Title page ────────────────────────────────────────────────────────────────
function titlePage() {
  return [
    // Dark header banner — using a table row as a banner
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [CONTENT_W],
      rows: [new TableRow({
        children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: noBorders(),
          shading: { fill: C.darkBlue, type: ShadingType.CLEAR },
          margins: { top: 400, bottom: 400, left: 400, right: 400 },
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('TATAHEER TRADERS (TAT)  ·  INFINITY CORP (INF)', { bold: true, size: 20, color: C.white })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [txt('TET – ERP SYSTEM', { bold: true, size: 52, color: C.white })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [txt('Architecture & Formula Blueprint', { size: 28, color: 'B0C8F0' })] }),
          ],
        })],
      })],
    }),
    para('', sp(400, 0)),
    // Meta info table
    new Table({
      width: { size: 5000, type: WidthType.DXA },
      columnWidths: [2000, 3000],
      rows: [
        ['Version', '2026.1'],
        ['Prepared by', 'Lead Developer'],
        ['Date', 'June 2026'],
        ['Status', '🔒 CONFIDENTIAL'],
      ].map(([k, v]) => new TableRow({
        children: [
          new TableCell({ width: { size: 2000, type: WidthType.DXA }, borders: noBorders(), margins: cellPadSm, children: [new Paragraph({ children: [txt(k, { bold: true, size: 20, color: C.midBlue })] })] }),
          new TableCell({ width: { size: 3000, type: WidthType.DXA }, borders: noBorders(), margins: cellPadSm, children: [new Paragraph({ children: [txt(v, { size: 20 })] })] }),
        ],
      })),
    }),
    pb(),
  ];
}

// ════════════════════════════════════════════════════════════════════════════
//  MAIN DOCUMENT
// ════════════════════════════════════════════════════════════════════════════
const doc = new Document({
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
      ],
    }],
  },
  styles: {
    default: { document: { run: { font: 'Calibri', size: 20 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Calibri', color: C.darkBlue },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Calibri', color: C.midBlue },
        paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.midBlue, space: 1 } },
          alignment: AlignmentType.RIGHT,
          children: [txt('TET-ERP Blueprint 2026  ·  CONFIDENTIAL', { size: 16, color: C.midBlue, italics: true })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.medGray, space: 1 } },
          children: [
            txt('Tataheer Traders ERP  ·  Version 2026.1', { size: 16, color: C.midBlue }),
            txt('          Page ', { size: 16, color: C.midBlue }),
            new TextRun({ children: [PageNumber.CURRENT], size: 16, font: 'Calibri', color: C.midBlue }),
            txt(' of ', { size: 16, color: C.midBlue }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, font: 'Calibri', color: C.midBlue }),
          ],
        })],
      }),
    },

    children: [
      // ── TITLE PAGE ─────────────────────────────────────────────────────────
      ...titlePage(),

      // ── SECTION 1 ──────────────────────────────────────────────────────────
      h1('1. System Overview'),
      divider(),
      bodyPara('TET-ERP is a full-stack, multi-company Enterprise Resource Planning system purpose-built for the corporate operations of Tataheer Traders and Infinity Corp. It provides real-time data isolation, double-entry ledger accounting, inventory management, client invoicing, and supply chain tracking — all in a single Progressive Web Application.'),
      para('', sp(100, 0)),
      h2('1.1  Technology Stack'),
      bullet('Frontend: React 18 (Vite), PWA-enabled with Service Worker cache-busting (__BUILD_TIME__ replacement)'),
      bullet('Backend: Node.js + Express.js REST API (ES Modules)'),
      bullet('Database: MongoDB Atlas via Mongoose ODM (strict: false flexible schemas)'),
      bullet('Cloud Storage: Cloudinary (product images, 10 MB limit)'),
      bullet('Authentication: Master Code + Role-based access (Admin / Employee / Client)'),
      bullet('PDF Export: jsPDF + autoTable (client-side, no server processing)'),
      bullet('Excel Export: SheetJS (client-side)'),
      para('', sp(100, 0)),
      h2('1.2  Multi-Company Configuration'),
      bodyPara('Two isolated companies operate on the same platform. Each has its own invoice counter, wallets, and prefix settings:'),
      para('', sp(80, 0)),
      makeTable(
        ['Company ID', 'Name', 'Invoice Start', 'Address', 'Email'],
        [
          ['TAT', 'Tataheer Traders', 'INV-201', '426-Ali Arcade, 13-km Main Multan Road, Lahore', 'tataheertraders@gmail.com'],
          ['INF', 'Infinity Corp', 'INV-180', '101-Choudery Plaza, Royal Park, Lahore', 'infinity.crop512@gmail.com'],
        ],
        [700, 1800, 1100, 3560, 2200]
      ),
      para('', sp(80, 0)),
      bodyPara('Data isolation is enforced at the API layer: every document stores a companyId field. All queries use a txFilter = { companyId } filter before returning any results to the frontend.', { italics: true }),

      pb(),

      // ── SECTION 2 ──────────────────────────────────────────────────────────
      h1('2. Module Flow & State Transitions'),
      divider(),
      bodyPara('The full sales and operations pipeline spans six interconnected document types. Each document has defined status states and automatically triggers the creation of the next document.'),
      para('', sp(120, 0)),
      h2('2.1  Full Sales Pipeline'),
      makeTable(
        ['Step', 'Document', 'Statuses', 'Triggers Next'],
        [
          ['1', 'Quotation', 'draft → sent → approved → expired', 'Convert to Invoice button'],
          ['2', 'Invoice', 'draft → sent → partial → paid → cancelled', 'Payment recorded in DayBook'],
          ['3', 'Supply Order', 'pending → delivered', 'Confirm Purchase button'],
          ['4', 'Purchase', 'received / partial / returned', 'Stock Movement IN auto-created'],
          ['5', 'Delivery Note', '—', 'Reduces invoiced qty tracker on invoice'],
          ['6', 'Payment', 'DayBook entry (income)', 'Invoice.advancePaid updated → partial/paid'],
        ],
        [500, 1500, 2600, 4760]
      ),
      para('', sp(200, 0)),
      h2('2.2  Quotation Schema'),
      bodyPara('Collection: quotations  |  Prefix: QUO-001  |  Company-isolated'),
      makeTable(
        ['Field', 'Type', 'Description'],
        [
          ['number', 'String', 'Auto-generated (QUO-001, QUO-002…)'],
          ['clientName', 'String', 'Contact name (from Contacts module)'],
          ['accountHeadID', 'String', 'Linked ledger account (e.g. CLI-001)'],
          ['date', 'String', 'ISO date'],
          ['subject', 'String', 'Title printed on PDF header'],
          ['items[]', 'Array', 'Line items: description, color, qty, unitPrice, useMatrix, matrixRows'],
          ['taxRate', 'Number', 'Selected rate (0, 5.5, 15, 18, or -1=custom)'],
          ['subtotal / taxAmount / total', 'Number', 'Computed on save'],
          ['status', 'String', 'draft | sent | approved | expired'],
          ['notes', 'String', 'Printed at bottom of PDF'],
          ['stealthPrint', 'Boolean', 'Hides unit prices on PDF if true'],
          ['companyId', 'String', 'TAT or INF — enforces data isolation'],
        ],
        [2000, 1500, 5860]
      ),
      para('', sp(200, 0)),
      h2('2.3  Invoice Schema'),
      bodyPara('Collection: invoices  |  Prefix: INV-201+ (TAT), INV-180+ (INF)  |  Company-isolated'),
      makeTable(
        ['Field', 'Type', 'Description'],
        [
          ['number', 'String', 'Auto-incremented per company, skip-taken logic'],
          ['accountHeadID', 'String', 'Linked ledger account (e.g. CLI-001)'],
          ['clientName / clientContact', 'String', 'Client details'],
          ['date / dueDate', 'String', 'Invoice and due dates'],
          ['subject', 'String', 'Title printed on PDF header'],
          ['items[]', 'Array', 'Line items with qty, unitPrice, matrix support'],
          ['subtotal / taxAmount / total', 'Number', 'Computed fields'],
          ['advancePaid', 'Number', 'Cumulative payments received'],
          ['balance', 'Number', 'total − advancePaid'],
          ['status', 'String', 'draft | sent | partial | paid | cancelled'],
          ['notes', 'String', 'Printed at bottom of invoice PDF'],
          ['stealthPrint', 'Boolean', 'Stealth mode hides unit prices'],
          ['companyId', 'String', 'TAT or INF'],
        ],
        [2200, 1400, 5760]
      ),
      para('', sp(200, 0)),
      h2('2.4  Invoice Number Generation Logic'),
      bodyPara('On every call to POST /api/next-invoice:'),
      bullet('Read company.invoiceCounter from Singleton document in MongoDB'),
      bullet('While an Invoice with that number already exists → num++ (skip-taken logic)'),
      bullet('Return the next safe, unused number to the frontend'),
      bullet('On confirmed save → bump company.invoiceCounter in the Singleton document'),
      bodyPara('Startup repair also runs: enforces a minimum floor (TAT=201, INF=180) and scans existing invoices to find the actual highest number, preventing counter regression after data restoration.', { italics: true }),

      pb(),

      // ── SECTION 3 ──────────────────────────────────────────────────────────
      h1('3. Mathematical Formulas'),
      divider(),

      h2('3.1  Line Item Amount Formula'),
      bodyPara('Each line item supports two qty modes: simple integer OR size/color matrix.'),
      para('', sp(80, 0)),
      // Formula box
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: { top: border(C.midBlue, 8), bottom: border(C.midBlue, 8), left: border(C.midBlue, 8), right: border(C.midBlue, 8) },
          shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('qty_i  =  if (useMatrix)  →  Σ [ Σ Object.values(row.sizes) ]  for each row in matrixRows', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
            new Paragraph({ children: [txt('       =  else  →  parseInt(item.qty)', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
            new Paragraph({ spacing: { before: 80 }, children: [txt('lineAmount_i  =  qty_i  ×  unitPrice_i', { font: 'Courier New', size: 20, bold: true, color: C.midBlue })] }),
            new Paragraph({ spacing: { before: 80 }, children: [txt('calcMatrixTotal(rows)  =  Σ rows → Σ Object.values(row.sizes)', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
          ],
        })]})],
      }),
      para('', sp(160, 0)),

      h2('3.2  Invoice & Quotation Totals'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: { top: border(C.green, 8), bottom: border(C.green, 8), left: border(C.green, 8), right: border(C.green, 8) },
          shading: { fill: 'E8F5EE', type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('effectiveTaxRate  =  (taxRate === -1)  ?  customTax  :  taxRate', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('subtotal    =  Σ ( qty_i  ×  unitPrice_i )   for all items i', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('taxAmount   =  subtotal  ×  effectiveTaxRate  ÷  100', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('total       =  subtotal  +  taxAmount', { font: 'Courier New', size: 20, bold: true, color: C.green })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('balance     =  total  −  advancePaid', { font: 'Courier New', size: 18, color: C.textDark })] }),
          ],
        })]})],
      }),
      para('', sp(160, 0)),

      h2('3.3  Sales Profitability Formula'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: { top: border(C.amber, 8), bottom: border(C.amber, 8), left: border(C.amber, 8), right: border(C.amber, 8) },
          shading: { fill: 'FFF8EC', type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('subtotal    =  Σ ( qty_i  ×  salePrice_i )', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('totalCost   =  Σ ( qty_i  ×  costPrice_i )', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('taxAmount   =  subtotal  ×  taxRate  ÷  100', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('total       =  subtotal  +  taxAmount', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('profit      =  subtotal  −  totalCost', { font: 'Courier New', size: 20, bold: true, color: C.amber })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('marginPct   =  ( profit  ÷  subtotal )  ×  100    →  displayed as %', { font: 'Courier New', size: 20, bold: true, color: C.amber })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('balance     =  total  −  paidAmount', { font: 'Courier New', size: 18, color: C.textDark })] }),
          ],
        })]})],
      }),
      para('', sp(160, 0)),

      h2('3.4  Net Profit Margin — Vendor / Supply Chain'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: { top: border(C.red, 8), bottom: border(C.red, 8), left: border(C.red, 8), right: border(C.red, 8) },
          shading: { fill: 'FFF0F0', type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('Net Profit  =  Quotation.total', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ children: [txt('            −  ( Raw Item Cost  +  Printing/Vendor Cost  +  Logistics  +  Tax )', { font: 'Courier New', size: 18, color: C.textDark })] }),
            new Paragraph({ spacing: { before: 80 }, children: [txt('In system terms:', { font: 'Courier New', size: 18, bold: true, color: C.red })] }),
            new Paragraph({ children: [txt('Net Profit  =  Invoice.total', { font: 'Courier New', size: 20, bold: true, color: C.red })] }),
            new Paragraph({ children: [txt('            −  ( Purchase.totalAmount  +  DayBook[expense].amount )', { font: 'Courier New', size: 20, bold: true, color: C.red })] }),
          ],
        })]})],
      }),
      para('', sp(160, 0)),

      h2('3.5  Advance Tracking Formula'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: cellBorders(C.medGray),
          shading: { fill: C.lightGray, type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('totalAdvances  =  Σ advances.amount', { font: 'Courier New', size: 18 })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('recovered      =  Σ advances[status="recovered"].amount', { font: 'Courier New', size: 18 })] }),
            new Paragraph({ spacing: { before: 60 }, children: [txt('outstanding    =  totalAdvances  −  recovered', { font: 'Courier New', size: 18, bold: true })] }),
            new Paragraph({ spacing: { before: 120 }, children: [txt('After recording a payment against an invoice:', { font: 'Courier New', size: 18, bold: true, color: C.midBlue })] }),
            new Paragraph({ children: [txt('  invoice.advancePaid  +=  paymentAmount', { font: 'Courier New', size: 18 })] }),
            new Paragraph({ children: [txt('  if advancePaid  >=  invoice.total  →  status = "paid"', { font: 'Courier New', size: 18 })] }),
            new Paragraph({ children: [txt('  else if advancePaid  >  0            →  status = "partial"', { font: 'Courier New', size: 18 })] }),
          ],
        })]})],
      }),

      pb(),

      // ── SECTION 4 ──────────────────────────────────────────────────────────
      h1('4. Ledger & Accounting Rules'),
      divider(),

      h2('4.1  Double-Entry Direction Rules'),
      makeTable(
        ['Transaction Type', 'Ledger Debit (Dr)', 'Ledger Credit (Cr)', 'Accounting Meaning'],
        [
          ['Income — Client Payment', { text: '0', color: C.green }, { text: 'amount', color: C.green }, 'Client paid us — AR reduces'],
          ['Expense — Supplier Payment', { text: 'amount', color: C.red }, { text: '0', color: C.red }, 'We paid supplier — AP reduces'],
          ['Advance Given', { text: 'amount', color: C.amber }, { text: '0', color: C.amber }, 'Cash out, receivable created'],
          ['Advance Received', { text: '0', color: C.green }, { text: 'amount', color: C.green }, 'Cash in, liability created'],
          ['Internal Transfer', 'amount', 'amount', 'Both sides move simultaneously'],
          ['Invoice Created', { text: 'amount', color: C.red }, { text: '0', color: C.red }, 'Client now owes us (AR increases)'],
          ['Purchase Confirmed', { text: '0', color: C.green }, { text: 'amount', color: C.green }, 'We now owe supplier (AP increases)'],
        ],
        [2400, 1500, 1500, 3960]
      ),
      para('', sp(160, 0)),

      h2('4.2  Ledger Entry Schema'),
      bodyPara('Collection: ledger  |  One entry per financial event  |  Running balance maintained'),
      makeTable(
        ['Field', 'Type', 'Values / Notes'],
        [
          ['accountHeadID', 'String', 'CLI-001, SUP-002, etc. — links to Contact'],
          ['contactName', 'String', 'Human-readable party name'],
          ['date', 'String', 'ISO date of transaction'],
          ['description', 'String', 'Auto-generated or manual description'],
          ['documentRef', 'String', 'INV-201, SO-001, QUO-005, etc.'],
          ['documentType', 'Enum', 'invoice | quotation | daybook | advance | payment | purchase | sale | manual'],
          ['debit', 'Number', 'Amount going out / owed to us'],
          ['credit', 'Number', 'Amount coming in / owed by us'],
          ['balance', 'Number', 'Running balance after this entry'],
        ],
        [2200, 1400, 5760]
      ),
      para('', sp(160, 0)),

      h2('4.3  Running Balance Calculation'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: cellBorders(C.midBlue),
          shading: { fill: C.lightBlue, type: ShadingType.CLEAR },
          margins: { top: 140, bottom: 140, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('runningBalance  =  openingBalance  +  Σ credits  −  Σ debits', { font: 'Courier New', size: 20, bold: true, color: C.darkBlue })] }),
          ],
        })]})],
      }),
      para('', sp(120, 0)),

      h2('4.4  Dedup Protection (Ledger POST)'),
      bodyPara('5-second dedup window: if a ledger entry with same accountHeadID + debit + credit + description was created within the last 5 seconds → return existing record (no duplicate inserted). This prevents double-posting from rapid-clicks or network retries.'),
      para('', sp(100, 0)),

      h2('4.5  DayBook Delete — Ledger Reversal Logic'),
      bodyPara('When a DayBook entry is deleted, the system automatically reverses its ledger effect:'),
      bullet('Step 1: Determine original ledger direction from type/category'),
      bullet('income → ledgerCredit = amount (0 debit)'),
      bullet('expense → ledgerDebit = amount (0 credit)', 1),
      bullet('Step 2: Post exact OPPOSITE entry (debit ↔ credit swapped)'),
      bullet('Step 3: Net ledger effect = zero — fully reversed in real time'),

      pb(),

      // ── SECTION 5 ──────────────────────────────────────────────────────────
      h1('5. Multi-Company Wallet Architecture'),
      divider(),

      h2('5.1  Wallet Structure (Per Company)'),
      bodyPara('Each company maintains 4 independent wallet balances stored in its entry inside the Singleton "companies" document in MongoDB:'),
      makeTable(
        ['Wallet', 'Key', 'Purpose'],
        [
          ['Cash', 'cash', 'Physical cash on hand in office'],
          ['Bank', 'bank', 'Corporate bank account balance'],
          ['JazzCash', 'jazzcash', 'Mobile wallet (JazzCash)'],
          ['EasyPaisa', 'easypaisa', 'Mobile wallet (EasyPaisa)'],
        ],
        [2200, 2000, 5160]
      ),
      para('', sp(160, 0)),

      h2('5.2  Company Isolation Rules'),
      bullet('Every DayBook, Invoice, Purchase, Quotation, SupplyOrder, and Advance document stores companyId'),
      bullet('The central data-load endpoint filters ALL collection queries with txFilter = { companyId }'),
      bullet('Wallet balances are stored separately per company in the companies[] array in the Singleton document'),
      bullet('The Ledger collection is shared but filtered by companyId on load — cross-company ledger leakage is impossible'),
      bullet('Invoice counter sequences are company-specific — TAT starts at INV-201, INF at INV-180'),
      para('', sp(120, 0)),

      h2('5.3  Idempotency — Duplicate Save Prevention'),
      bodyPara('All POST endpoints implement the following check before inserting:'),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [CONTENT_W],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: CONTENT_W, type: WidthType.DXA },
          borders: cellBorders(C.medGray),
          shading: { fill: C.lightGray, type: ShadingType.CLEAR },
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: [
            new Paragraph({ children: [txt('if (req.body.id) {', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
            new Paragraph({ children: [txt('  const existing = await Model.findOne({ id: req.body.id })', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
            new Paragraph({ children: [txt('  if (existing) return res.json(existing)  // ← no double-insert', { font: 'Courier New', size: 18, color: C.green, bold: true })] }),
            new Paragraph({ children: [txt('}', { font: 'Courier New', size: 18, color: C.darkBlue })] }),
          ],
        })]})],
      }),
      bodyPara('The client generates a unique id = Date.now().toString() before the first POST. If the user double-clicks Save or the network retries, the server returns the already-saved record rather than creating a duplicate.', { italics: true }),

      pb(),

      // ── SECTION 6 ──────────────────────────────────────────────────────────
      h1('6. Supply Chain & Vendor Module'),
      divider(),

      h2('6.1  Supply Order → Purchase → Stock Flow'),
      makeTable(
        ['Stage', 'Action', 'Result'],
        [
          ['1. Supply Order', 'Created with items, vendor, and unit prices', 'Status: pending — no stock change yet'],
          ['2. Confirm Received', 'Admin clicks "Confirm Received" on SO', 'Purchase record auto-created; SO status → delivered'],
          ['3. Stock Movement IN', 'Triggered automatically on purchase confirm', 'inventory.qty += qty for each item'],
          ['4. Ledger AP Entry', 'Auto-posted to supplier ledger on purchase', 'Accounts Payable increases by totalAmount'],
        ],
        [2200, 3400, 3760]
      ),
      para('', sp(160, 0)),

      h2('6.2  Stock Movement Types'),
      makeTable(
        ['Type', 'Trigger', 'Effect on Inventory'],
        [
          ['IN', 'Purchase confirmed', 'inventory.qty += qty'],
          ['OUT', 'Sale confirmed', 'inventory.qty -= qty (with low-stock warning if < 0)'],
          ['ADJUSTMENT', 'Manual admin action', 'inventory.qty = newQty (absolute set)'],
          ['RETURN', 'Purchase or Sale returned', 'Reverses the original qty change'],
        ],
        [1600, 3000, 4760]
      ),
      para('', sp(160, 0)),

      h2('6.3  Inventory Item Schema'),
      makeTable(
        ['Field', 'Type', 'Notes'],
        [
          ['id', 'String', 'UUID-style timestamp ID'],
          ['name', 'String', 'Product name'],
          ['sku', 'String', 'Stock Keeping Unit code'],
          ['category', 'String', 'Product category'],
          ['unit', 'String', 'pcs, kg, meters, etc.'],
          ['costPrice', 'Number', 'Weighted average purchase cost'],
          ['sellPrice', 'Number', 'Default selling price'],
          ['qty', 'Number', 'Current stock on hand'],
          ['color', 'String', 'Default color (overridden by matrix)'],
          ['image', 'String', 'Cloudinary URL'],
          ['notes', 'String', 'Internal notes'],
        ],
        [1800, 1400, 6160]
      ),

      pb(),

      // ── SECTION 7 — FINANCIAL REPORT ────────────────────────────────────────
      h1('7. Financial Report — June 2026'),
      divider(),
      bodyPara('This section defines the exact formulas and data sources used to compute all financial metrics displayed on the Dashboard and exportable reports. Figures shown here are formula definitions; actual values are computed live from MongoDB collections.'),
      para('', sp(120, 0)),

      h2('7.1  Revenue Summary'),
      makeTable(
        ['Metric', 'Formula', 'Data Source'],
        [
          ['Total Invoiced', 'Σ invoice.total  (all statuses)', 'invoices collection'],
          ['Total Collected', 'Σ invoice.advancePaid', 'invoices collection'],
          ['Outstanding AR', 'Total Invoiced − Total Collected', 'Calculated'],
          ['Total Sales Revenue', 'Σ sale.total  (status = confirmed)', 'sales collection'],
        ],
        [2800, 3500, 3060]
      ),
      para('', sp(160, 0)),

      h2('7.2  Cost & Profit'),
      makeTable(
        ['Metric', 'Formula', 'Data Source'],
        [
          ['Total COGS', 'Σ sale.totalCost', 'sales collection'],
          ['Gross Profit', 'Total Sales Revenue − Total COGS', 'Calculated'],
          ['Average Gross Margin %', '( Gross Profit ÷ Revenue ) × 100', 'Calculated'],
          ['Net Profit (est.)', 'Invoice.total − Purchase.totalAmount − DayBook[expense].amount', 'Multi-collection'],
        ],
        [2800, 3800, 2760]
      ),
      para('', sp(160, 0)),

      h2('7.3  Payables (Accounts Payable)'),
      makeTable(
        ['Metric', 'Formula', 'Data Source'],
        [
          ['Total Purchases', 'Σ purchase.totalAmount', 'purchases collection'],
          ['Paid to Suppliers', 'Σ purchase.paidAmount', 'purchases collection'],
          ['Outstanding AP', 'Total Purchases − Paid to Suppliers', 'Calculated'],
        ],
        [2800, 3500, 3060]
      ),
      para('', sp(160, 0)),

      h2('7.4  Cash Position'),
      makeTable(
        ['Wallet', 'Balance Source (per company Singleton)'],
        [
          ['Cash', 'companies[TAT].wallets.cash  +  companies[INF].wallets.cash'],
          ['Bank', 'companies[TAT].wallets.bank  +  companies[INF].wallets.bank'],
          ['JazzCash', 'companies[TAT].wallets.jazzcash'],
          ['EasyPaisa', 'companies[TAT].wallets.easypaisa'],
        ],
        [2000, 7360]
      ),
      para('', sp(160, 0)),

      h2('7.5  Advances'),
      makeTable(
        ['Metric', 'Formula'],
        [
          ['Total Advances Given', 'Σ advances.amount'],
          ['Recovered', 'Σ advances[status = "recovered"].amount'],
          ['Outstanding', 'Total Advances − Recovered'],
        ],
        [3500, 5860]
      ),
      para('', sp(160, 0)),

      h2('7.6  DayBook Summary'),
      makeTable(
        ['Metric', 'Formula'],
        [
          ['Total Debit (money out)', 'Σ dayBook.debit'],
          ['Total Credit (money in)', 'Σ dayBook.credit'],
          ['Net Cash Balance', 'Total Credit − Total Debit'],
          ['Income Entries', 'Σ dayBook[type = "income"].debit'],
          ['Expense Entries', 'Σ dayBook[type = "expense"].credit'],
        ],
        [3500, 5860]
      ),

      pb(),

      // ── SECTION 8 ──────────────────────────────────────────────────────────
      h1('8. Module Reference Table'),
      divider(),
      makeTable(
        ['Module', 'API Route', 'Key Actions', 'Linked Modules'],
        [
          ['Quotation', '/api/quotations', 'Create, Convert→Invoice, Convert→SO, PDF, Stealth print', 'Invoice, SupplyOrder, Ledger'],
          ['Invoice', '/api/invoices', 'Create, Mark Paid, PDF, Delivery Note, Convert→SO, Status track', 'Ledger, DayBook, DeliveryNote, Contacts'],
          ['Supply Order', '/api/supplyOrders', 'Create from Quote/Invoice, Confirm Received→Purchase', 'Purchase, Inventory, Ledger'],
          ['Purchase', '/api/purchases', 'Confirm receipt, Stock IN, Ledger AP auto-post', 'Inventory, Ledger, SupplyOrder'],
          ['Sales', '/api/sales', 'Record sale, Stock OUT, Profit & margin calc', 'Inventory, Ledger, Invoice'],
          ['Delivery Note', '/api/deliveryNotes', 'Partial or full delivery tracking per invoice', 'Invoice'],
          ['DayBook', '/api/dayBook', 'Income/Expense/Advance/Transfer, ledger auto-post', 'Ledger, Invoice (status update)'],
          ['Ledger', '/api/ledger', 'Running balance per contact, all transaction history', 'All modules'],
          ['Inventory', '/api/inventory', 'Stock management, Cloudinary images, cost/sell price', 'Purchase, Sales, SupplyOrder'],
          ['Contacts', '/api/contacts', 'Clients, Suppliers, Staff — account head IDs', 'All modules'],
          ['Advances', '/api/advances', 'Advance tracking, invoice payment linkage', 'Invoice, Ledger'],
          ['Settings', '/api/settings', 'Master code, company config, wallets, categories', 'All modules'],
        ],
        [1600, 2000, 3100, 2660]
      ),

      para('', sp(300, 0)),
      divider(),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200 },
        children: [
          txt('TET-ERP Architecture Blueprint  ·  Version 2026.1  ·  Tataheer Traders', { size: 18, color: C.midBlue, italics: true }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [txt('CONFIDENTIAL — Internal Use Only', { size: 16, bold: true, color: C.red })],
      }),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('D:\\tat-erp\\TET-ERP-Blueprint-2026.docx', buf);
  console.log('✅  TET-ERP-Blueprint-2026.docx written successfully');
}).catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
