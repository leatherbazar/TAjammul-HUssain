import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.static(join(__dirname, 'dist')))

// ─── CONNECT MONGODB ──────────────────────────────────────────────────────────
mongoose.connect(process.env.DATABASE_URL)
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err))

// ═══════════════════════════════════════════════════════════════════════════════
//  SCHEMAS & MODELS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Contact (Supplier / Client / Staff) ──────────────────────────────────────
const ContactSchema = new mongoose.Schema({
  id:             { type: String, index: true },
  accountHeadID:  { type: String, unique: true, index: true }, // e.g. CLI-001
  type:           { type: String, enum: ['client', 'supplier', 'staff'], required: true },
  name:           { type: String, required: true },
  phone:          String,
  email:          String,
  address:        String,
  accountCode:    String,
  notes:          String,
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 }, // auto-maintained by ledger triggers
}, { timestamps: true })

const Contact = mongoose.model('Contact', ContactSchema)

// ── Ledger Entry ──────────────────────────────────────────────────────────────
const LedgerSchema = new mongoose.Schema({
  id:            { type: String, index: true },
  accountHeadID: { type: String, required: true, index: true }, // links to Contact
  contactName:   String,
  date:          String,
  description:   String,
  documentRef:   String,  // e.g. INV-201, QT-005
  documentType:  { type: String, enum: ['invoice', 'quotation', 'daybook', 'advance', 'payment', 'purchase', 'sale', 'manual'] },
  debit:         { type: Number, default: 0 }, // client owes us / we owe supplier
  credit:        { type: Number, default: 0 }, // payment received / we paid supplier
  balance:       { type: Number, default: 0 }, // running balance after this entry
}, { timestamps: true })

const Ledger = mongoose.model('Ledger', LedgerSchema)

// ── Purchase (confirmed inward stock) ─────────────────────────────────────────
const PurchaseSchema = new mongoose.Schema({
  id:                { type: String, index: true },
  number:            { type: String, unique: true, sparse: true },
  supplyOrderId:     String,
  supplyOrderNumber: String,
  supplierName:      String,
  supplierContact:   String,
  accountHeadID:     String,
  date:              String,
  items:             mongoose.Schema.Types.Mixed, // [{ description, color, qty, unit, costPrice, amount, inventoryId, matrixRows }]
  totalAmount:       { type: Number, default: 0 },
  paidAmount:        { type: Number, default: 0 },
  paymentStatus:     { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  notes:             String,
  status:            { type: String, enum: ['received', 'partial', 'returned'], default: 'received' },
}, { timestamps: true })
const Purchase = mongoose.model('Purchase', PurchaseSchema)

// ── Sale (outward from inventory) ─────────────────────────────────────────────
const SaleSchema = new mongoose.Schema({
  id:            { type: String, index: true },
  number:        { type: String, unique: true, sparse: true },
  clientName:    String,
  clientContact: String,
  accountHeadID: String,
  invoiceRef:    String,
  date:          String,
  items:         mongoose.Schema.Types.Mixed, // [{ inventoryId, description, color, qty, unit, costPrice, salePrice, amount, profit, marginPct }]
  subtotal:      { type: Number, default: 0 },
  totalCost:     { type: Number, default: 0 },
  totalProfit:   { type: Number, default: 0 },
  taxRate:       { type: Number, default: 0 },
  taxAmount:     { type: Number, default: 0 },
  total:         { type: Number, default: 0 },
  paidAmount:    { type: Number, default: 0 },
  paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  notes:         String,
  status:        { type: String, enum: ['confirmed', 'cancelled', 'returned'], default: 'confirmed' },
}, { timestamps: true })
const Sale = mongoose.model('Sale', SaleSchema)

// ── Stock Movement (audit trail of IN / OUT) ──────────────────────────────────
const StockMovementSchema = new mongoose.Schema({
  id:           { type: String, index: true },
  inventoryId:  { type: String, index: true },
  itemName:     String,
  date:         String,
  type:         { type: String, enum: ['IN', 'OUT', 'ADJUSTMENT'] },
  qty:          Number,
  unit:         String,
  color:        String,
  costPrice:    Number,
  salePrice:    Number,
  documentRef:  String,
  documentType: { type: String, enum: ['purchase', 'sale', 'adjustment', 'return'] },
  notes:        String,
}, { timestamps: true })
const StockMovement = mongoose.model('StockMovement', StockMovementSchema)

// ── Invoice ───────────────────────────────────────────────────────────────────
const InvoiceSchema = new mongoose.Schema({
  id:            { type: String, index: true },
  number:        { type: String, unique: true, sparse: true },
  accountHeadID: String,  // linked Contact accountHeadID
  clientName:    String,
  clientContact: String,
  date:          String,
  items:         mongoose.Schema.Types.Mixed,
  subtotal:      Number,
  taxRate:       Number,
  taxAmount:     Number,
  total:         Number,
  advancePaid:   Number,
  balance:       Number,
  status:        String,
  notes:         String,
  stealth:       Boolean,
}, { strict: false, timestamps: true })

const Invoice = mongoose.model('Invoice', InvoiceSchema)

// ── Generic flexible schemas for other collections ────────────────────────────
const flex = () => new mongoose.Schema({}, { strict: false, timestamps: true })

const OTHER_COLLECTIONS = [
  'quotations', 'supplyOrders', 'deliveryNotes',
  'inventory', 'transactions', 'advances', 'dayBook', 'calendarEvents'
]
const models = { invoices: Invoice }
OTHER_COLLECTIONS.forEach(name => {
  models[name] = mongoose.model(name, flex())
})

// ── User ──────────────────────────────────────────────────────────────────────
const User = mongoose.model('User', new mongoose.Schema({
  id:       { type: String, index: true },
  username: { type: String, unique: true, sparse: true },
  password: String,
  name:     String,
  role:     { type: String, enum: ['admin', 'employee', 'client'] },
  phone:    String,
  email:    String,
  company:  String,
  address:  String,
  active:   Boolean,
  empRole:  String,
}, { timestamps: true }))

// ── Singleton (wallets, settings, masterCode) ─────────────────────────────────
const Singleton = mongoose.model('Singleton', new mongoose.Schema({
  key:   { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
}))

// ═══════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function fmt(doc) {
  const obj = doc && doc.toObject ? doc.toObject() : { ...doc }
  const { _id, __v, ...rest } = obj
  return { ...rest, id: rest.id || (_id ? _id.toString() : undefined) }
}

function fmtLean(d) {
  const { _id, __v, ...rest } = d
  return { ...rest, id: rest.id || (_id ? _id.toString() : undefined) }
}

// ── Auto-generate accountHeadID ───────────────────────────────────────────────
const PREFIX = { client: 'CLI', supplier: 'SUP', staff: 'STF' }

async function generateAccountHeadID(type) {
  const prefix = PREFIX[type] || 'ACC'
  const last = await Contact.findOne({ type }).sort({ accountHeadID: -1 }).lean()
  let num = 1
  if (last?.accountHeadID) {
    const parts = last.accountHeadID.split('-')
    num = (parseInt(parts[1]) || 0) + 1
  }
  return `${prefix}-${String(num).padStart(3, '0')}`
}

// ── Ledger trigger: create entry + update contact balance ─────────────────────
async function postLedgerEntry({ accountHeadID, contactName, date, description, documentRef, documentType, debit, credit }) {
  if (!accountHeadID) return

  // Get last balance for this account
  const lastEntry = await Ledger.findOne({ accountHeadID }).sort({ createdAt: -1 }).lean()
  const prevBalance = lastEntry?.balance || 0
  const newBalance = prevBalance + debit - credit

  const entry = await Ledger.create({
    id: Date.now().toString(),
    accountHeadID,
    contactName,
    date: date || new Date().toISOString().slice(0, 10),
    description,
    documentRef,
    documentType,
    debit,
    credit,
    balance: newBalance,
  })

  // Update contact's currentBalance
  await Contact.findOneAndUpdate(
    { accountHeadID },
    { $set: { currentBalance: newBalance } }
  )

  return entry
}

// ═══════════════════════════════════════════════════════════════════════════════
//  INITIALIZE DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════

mongoose.connection.once('open', async () => {
  try {
    await Singleton.findOneAndUpdate({ key: 'wallets' }, { $setOnInsert: { value: { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 } } }, { upsert: true })
    await Singleton.findOneAndUpdate({ key: 'settings' }, { $setOnInsert: { value: { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' } } }, { upsert: true })
    await Singleton.findOneAndUpdate({ key: 'masterCode' }, { $setOnInsert: { value: '5555' } }, { upsert: true })
    await User.findOneAndUpdate(
      { role: 'admin' },
      { $set: { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', name: 'Administrator', role: 'admin' }, $setOnInsert: { id: 'admin' } },
      { upsert: true }
    )
    console.log('✅ Database defaults initialized')
  } catch (err) {
    console.error('Init error:', err)
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await User.findOne({ username, password })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (user.role === 'employee' && user.active === false)
      return res.status(401).json({ error: 'Account disabled. Contact admin.' })
    res.json(fmt(user))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password, company, phone } = req.body
    if (!name || !username || !password) return res.status(400).json({ error: 'Name, username and password are required.' })
    if (await User.findOne({ username })) return res.status(400).json({ error: 'Username already taken.' })
    const user = await User.create({ id: Date.now().toString(), name, username, password, company, phone, role: 'client' })
    res.json(fmt(user))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTACTS  (with accountHeadID + Ledger integration)
// ═══════════════════════════════════════════════════════════════════════════════

// Search contacts for dropdown (used by Invoice, Quotation, DayBook, DeliveryNote)
app.get('/api/contacts/search', async (req, res) => {
  try {
    const { type, q } = req.query
    const filter = {}
    if (type) filter.type = type
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { accountHeadID: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
    ]
    const contacts = await Contact.find(filter).sort({ name: 1 }).limit(50).lean()
    res.json({ contacts: contacts.map(fmtLean) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Get all contacts (with optional type filter)
app.get('/api/contacts', async (req, res) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {}
    const contacts = await Contact.find(filter).sort({ createdAt: -1 }).lean()
    res.json({ contacts: contacts.map(fmtLean) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Get single contact
app.get('/api/contacts/:id', async (req, res) => {
  try {
    const contact = await Contact.findOne({ id: req.params.id }).lean()
    if (!contact) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(contact))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Create contact — auto-generates accountHeadID
app.post('/api/contacts', async (req, res) => {
  try {
    const { type, name, phone, email, address, accountCode, notes, openingBalance } = req.body
    if (!type || !name) return res.status(400).json({ error: 'type and name are required' })

    const accountHeadID = await generateAccountHeadID(type)
    const ob = parseFloat(openingBalance) || 0

    const contact = await Contact.create({
      id: Date.now().toString(),
      accountHeadID,
      type, name, phone, email, address, accountCode, notes,
      openingBalance: ob,
      currentBalance: ob,
    })

    // Post opening balance as first ledger entry if non-zero
    if (ob !== 0) {
      await postLedgerEntry({
        accountHeadID,
        contactName: name,
        date: new Date().toISOString().slice(0, 10),
        description: 'Opening Balance',
        documentRef: accountHeadID,
        documentType: 'manual',
        debit: ob > 0 ? ob : 0,
        credit: ob < 0 ? Math.abs(ob) : 0,
      })
    }

    res.json(fmt(contact))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Update contact (accepts MongoDB _id or custom id field)
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const { type, name, phone, email, address, notes, openingBalance } = req.body
    const update = { $set: { type, name, phone, email, address, notes, openingBalance } }
    let contact = await Contact.findByIdAndUpdate(req.params.id, update, { new: true }).lean().catch(() => null)
    if (!contact) contact = await Contact.findOneAndUpdate({ id: req.params.id }, update, { new: true }).lean()
    if (!contact) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(contact))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Delete contact (accepts MongoDB _id or custom id field)
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    let doc = await Contact.findByIdAndDelete(req.params.id).lean().catch(() => null)
    if (!doc) await Contact.findOneAndDelete({ id: req.params.id })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  LEDGER
// ═══════════════════════════════════════════════════════════════════════════════

// Get ledger for an account
app.get('/api/ledger/:accountHeadID', async (req, res) => {
  try {
    const entries = await Ledger.find({ accountHeadID: req.params.accountHeadID })
      .sort({ createdAt: 1 }).lean()
    const contact = await Contact.findOne({ accountHeadID: req.params.accountHeadID }).lean()
    res.json({
      contact: contact ? fmtLean(contact) : null,
      entries: entries.map(fmtLean),
      currentBalance: contact?.currentBalance || 0,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Manual ledger entry
app.post('/api/ledger', async (req, res) => {
  try {
    const entry = await postLedgerEntry(req.body)
    res.json(fmt(entry))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICES  (with auto ledger trigger)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean()
    res.json(invoices.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/invoices', async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body)

    // ── LEDGER TRIGGER ────────────────────────────────────────────────────────
    if (req.body.accountHeadID && req.body.total > 0) {
      await postLedgerEntry({
        accountHeadID: req.body.accountHeadID,
        contactName:   req.body.clientName,
        date:          req.body.date,
        description:   `Invoice: ${req.body.number || ''}`,
        documentRef:   req.body.number,
        documentType:  'invoice',
        debit:         parseFloat(req.body.total) || 0, // client owes us
        credit:        0,
      })
    }

    res.json(fmt(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean()
    if (!invoice) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(invoice))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    await Invoice.findOneAndDelete({ id: req.params.id })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  DAYBOOK  (with auto ledger trigger for payments)
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/dayBook', async (req, res) => {
  try {
    const doc = await models.dayBook.create(req.body)

    // ── LEDGER TRIGGER — fires whenever a party account is linked ─────────────
    if (req.body.accountHeadID) {
      const debit  = parseFloat(req.body.debit)  || 0
      const credit = parseFloat(req.body.credit) || 0
      if (debit > 0 || credit > 0) {
        await postLedgerEntry({
          accountHeadID: req.body.accountHeadID,
          contactName:   req.body.partyName || req.body.description,
          date:          req.body.date,
          description:   req.body.description || 'Day Book Entry',
          documentRef:   req.body.reference  || doc.id,
          documentType:  'daybook',
          debit,
          credit,
        })
      }
    }

    res.json(fmt(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  LOAD ALL DATA  (initial page load)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/data', async (req, res) => {
  try {
    const result = {}

    // Contacts from dedicated model
    const contacts = await Contact.find().sort({ createdAt: -1 }).lean()
    result.contacts = contacts.map(fmtLean)

    // Invoices from dedicated model
    const invoices = await Invoice.find().sort({ createdAt: -1 }).lean()
    result.invoices = invoices.map(fmtLean)

    // Purchases and Sales from dedicated models
    const [purchases, sales] = await Promise.all([
      Purchase.find().sort({ createdAt: -1 }).lean(),
      Sale.find().sort({ createdAt: -1 }).lean(),
    ])
    result.purchases = purchases.map(fmtLean)
    result.sales     = sales.map(fmtLean)

    // Other collections
    for (const name of OTHER_COLLECTIONS) {
      const docs = await models[name].find().sort({ createdAt: -1 }).lean()
      result[name] = docs.map(fmtLean)
    }

    // Users
    const [employees, clients, admin] = await Promise.all([
      User.find({ role: 'employee' }).lean(),
      User.find({ role: 'client' }).lean(),
      User.findOne({ role: 'admin' }).lean(),
    ])
    result.users = {
      admin: { username: admin?.username || 'admin', password: admin?.password || 'admin123', name: admin?.name || 'Administrator', role: 'admin' },
      employees: employees.map(fmtLean),
      clients:   clients.map(fmtLean),
    }

    // Singletons
    const [walletDoc, settingsDoc, masterDoc] = await Promise.all([
      Singleton.findOne({ key: 'wallets' }).lean(),
      Singleton.findOne({ key: 'settings' }).lean(),
      Singleton.findOne({ key: 'masterCode' }).lean(),
    ])
    result.wallets    = walletDoc?.value   || { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 }
    result.settings   = settingsDoc?.value || { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' }
    result.masterCode = masterDoc?.value   || '5555'

    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERIC COLLECTION CRUD  (for remaining collections)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Supply Order — saved as procurement intent; ledger only posts on Purchase confirm ──
app.post('/api/supplyOrders', async (req, res) => {
  try {
    const doc = await models.supplyOrders.create(req.body)
    res.json(fmt(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASES  (Inward stock + Supplier AP ledger)
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: merge qty into existing inventory or create new item
async function upsertInventoryItem({ description, color, qty, unit, costPrice, supplierName, matrixRows }) {
  // Try exact name match first
  let inv = await models.inventory.findOne({ name: { $regex: `^${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).lean()
  if (inv) {
    await models.inventory.findOneAndUpdate({ id: inv.id }, { $inc: { qty }, $set: { costPrice, updatedAt: new Date() } })
    return inv
  }
  // Create new
  const newInv = await models.inventory.create({
    id: Date.now().toString() + Math.floor(Math.random() * 9999),
    name: description,
    color: color || '',
    category: 'Purchased',
    sku: `SKU-${Date.now().toString().slice(-6)}`,
    qty,
    unit: unit || 'pcs',
    costPrice,
    sellPrice: 0,
    minStock: 0,
    supplier: supplierName || '',
    useMatrix: !!(matrixRows && matrixRows.length),
    matrixRows: matrixRows || [],
  })
  return newInv
}

// Convert Supply Order → Purchase (main "Confirm & Receive" action)
app.post('/api/purchases/from-supply-order/:soId', async (req, res) => {
  try {
    const order = await models.supplyOrders.findOne({ id: req.params.soId }).lean()
    if (!order) return res.status(404).json({ error: 'Supply order not found' })
    if (order.purchaseRef) return res.status(400).json({ error: 'Already converted to purchase' })

    const count = await Purchase.countDocuments()
    const number = `PUR-${String(count + 1).padStart(4, '0')}`
    const purchaseDate = req.body.date || order.date || new Date().toISOString().slice(0, 10)

    let totalAmount = 0
    const purchaseItems = []

    for (const item of (order.items || [])) {
      const qty      = parseInt(item.qty) || 0
      const costPrice = parseFloat(item.marketPrice) || 0
      const amount   = qty * costPrice
      totalAmount   += amount

      // Upsert into inventory
      const inv = await upsertInventoryItem({
        description:  item.description,
        color:        item.color || '',
        qty,
        unit:         item.unit || 'pcs',
        costPrice,
        supplierName: order.supplierName,
        matrixRows:   item.matrixRows || [],
      })

      // Stock movement log
      await StockMovement.create({
        id: Date.now().toString() + Math.floor(Math.random() * 999),
        inventoryId:  inv.id,
        itemName:     item.description,
        date:         purchaseDate,
        type:         'IN',
        qty,
        unit:         item.unit || 'pcs',
        color:        item.color || '',
        costPrice,
        documentRef:  number,
        documentType: 'purchase',
        notes:        `From SO ${order.number}`,
      })

      purchaseItems.push({
        description:  item.description,
        color:        item.color || '',
        qty,
        unit:         item.unit || 'pcs',
        costPrice,
        amount,
        inventoryId:  inv.id,
        matrixRows:   item.matrixRows || [],
      })
    }

    // Create Purchase record
    const purchase = await Purchase.create({
      id: Date.now().toString(),
      number,
      supplyOrderId:     order.id,
      supplyOrderNumber: order.number,
      supplierName:      order.supplierName,
      supplierContact:   order.supplierContact,
      accountHeadID:     order.accountHeadID,
      date:              purchaseDate,
      items:             purchaseItems,
      totalAmount,
      paidAmount:        0,
      paymentStatus:     'unpaid',
      notes:             req.body.notes || order.notes || '',
      status:            'received',
    })

    // Mark supply order as delivered
    await models.supplyOrders.findOneAndUpdate({ id: req.params.soId }, {
      $set: { status: 'delivered', purchaseRef: number }
    })

    // ── SUPPLIER LEDGER: Credit = goods received (AP — we owe supplier) ────────
    if (order.accountHeadID && totalAmount > 0) {
      await postLedgerEntry({
        accountHeadID: order.accountHeadID,
        contactName:   order.supplierName,
        date:          purchaseDate,
        description:   `Purchase Received: ${number} (ref ${order.number})`,
        documentRef:   number,
        documentType:  'purchase',
        debit:         0,
        credit:        totalAmount,  // credit on supplier = AP increases (we owe them)
      })
    }

    res.json({ ok: true, purchase: fmt(purchase) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// List all purchases
app.get('/api/purchases', async (req, res) => {
  try {
    const docs = await Purchase.find().sort({ createdAt: -1 }).lean()
    res.json(docs.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Direct purchase (not from SO)
app.post('/api/purchases', async (req, res) => {
  try {
    const count  = await Purchase.countDocuments()
    const number = `PUR-${String(count + 1).padStart(4, '0')}`
    const purchaseDate = req.body.date || new Date().toISOString().slice(0, 10)

    let totalAmount = 0
    const purchaseItems = []

    for (const item of (req.body.items || [])) {
      const qty       = parseInt(item.qty) || 0
      const costPrice = parseFloat(item.costPrice) || 0
      const amount    = qty * costPrice
      totalAmount    += amount

      const inv = await upsertInventoryItem({
        description:  item.description,
        color:        item.color || '',
        qty,
        unit:         item.unit || 'pcs',
        costPrice,
        supplierName: req.body.supplierName,
        matrixRows:   item.matrixRows || [],
      })

      await StockMovement.create({
        id: Date.now().toString() + Math.floor(Math.random() * 999),
        inventoryId:  inv.id,
        itemName:     item.description,
        date:         purchaseDate,
        type:         'IN',
        qty,
        unit:         item.unit || 'pcs',
        color:        item.color || '',
        costPrice,
        documentRef:  number,
        documentType: 'purchase',
      })

      purchaseItems.push({ ...item, qty, costPrice, amount, inventoryId: inv.id })
    }

    const purchase = await Purchase.create({
      ...req.body,
      id: Date.now().toString(),
      number,
      items: purchaseItems,
      totalAmount,
    })

    if (req.body.accountHeadID && totalAmount > 0) {
      await postLedgerEntry({
        accountHeadID: req.body.accountHeadID,
        contactName:   req.body.supplierName,
        date:          purchaseDate,
        description:   `Purchase: ${number}`,
        documentRef:   number,
        documentType:  'purchase',
        debit:         0,
        credit:        totalAmount,
      })
    }

    res.json(fmt(purchase))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/purchases/:id', async (req, res) => {
  try {
    const doc = await Purchase.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/purchases/:id', async (req, res) => {
  try { await Purchase.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SALES  (Outward stock + Customer AR ledger + Profit tracking)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/sales', async (req, res) => {
  try {
    const docs = await Sale.find().sort({ createdAt: -1 }).lean()
    res.json(docs.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/sales', async (req, res) => {
  try {
    const count  = await Sale.countDocuments()
    const number = `SAL-${String(count + 1).padStart(4, '0')}`
    const saleDate = req.body.date || new Date().toISOString().slice(0, 10)

    let subtotal  = 0
    let totalCost = 0
    const saleItems  = []
    const stockErrs  = []

    for (const item of (req.body.items || [])) {
      const qty       = parseInt(item.qty) || 0
      const costPrice = parseFloat(item.costPrice) || 0
      const salePrice = parseFloat(item.salePrice) || 0
      const amount    = qty * salePrice
      const cost      = qty * costPrice
      const profit    = amount - cost
      const marginPct = amount > 0 ? +((profit / amount) * 100).toFixed(1) : 0

      subtotal  += amount
      totalCost += cost

      // Deduct from inventory
      if (item.inventoryId) {
        const inv = await models.inventory.findOne({ id: item.inventoryId }).lean()
        if (inv) {
          if ((inv.qty || 0) < qty) {
            stockErrs.push(`"${inv.name}": only ${inv.qty || 0} in stock, need ${qty}`)
          } else {
            await models.inventory.findOneAndUpdate({ id: item.inventoryId }, { $inc: { qty: -qty } })
          }
        }
        await StockMovement.create({
          id: Date.now().toString() + Math.floor(Math.random() * 999),
          inventoryId:  item.inventoryId,
          itemName:     item.description,
          date:         saleDate,
          type:         'OUT',
          qty,
          unit:         item.unit || 'pcs',
          color:        item.color || '',
          costPrice,
          salePrice,
          documentRef:  number,
          documentType: 'sale',
        })
      }

      saleItems.push({ ...item, qty, costPrice, salePrice, amount, profit, marginPct })
    }

    if (stockErrs.length > 0) {
      return res.status(400).json({ error: `Insufficient stock:\n${stockErrs.join('\n')}` })
    }

    const taxRate   = parseFloat(req.body.taxRate) || 0
    const taxAmount = +(subtotal * taxRate / 100).toFixed(2)
    const total     = subtotal + taxAmount
    const totalProfit = subtotal - totalCost  // profit before tax

    const sale = await Sale.create({
      ...req.body,
      id: Date.now().toString(),
      number,
      items:       saleItems,
      subtotal,
      totalCost,
      totalProfit,
      taxAmount,
      total,
      status: 'confirmed',
    })

    // ── CUSTOMER LEDGER: Debit = AR (customer owes us) ────────────────────────
    if (req.body.accountHeadID && total > 0) {
      await postLedgerEntry({
        accountHeadID: req.body.accountHeadID,
        contactName:   req.body.clientName,
        date:          saleDate,
        description:   `Sale: ${number}`,
        documentRef:   number,
        documentType:  'sale',
        debit:         total,
        credit:        0,
      })
    }

    res.json(fmt(sale))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/sales/:id', async (req, res) => {
  try {
    const doc = await Sale.findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true }).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/sales/:id', async (req, res) => {
  try { await Sale.findOneAndDelete({ id: req.params.id }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  INVENTORY SEARCH  (for Sales product picker)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/inventory/search', async (req, res) => {
  try {
    const { q } = req.query
    const filter = q
      ? { $or: [{ name: { $regex: q, $options: 'i' } }, { sku: { $regex: q, $options: 'i' } }, { category: { $regex: q, $options: 'i' } }] }
      : {}
    // Show all items (including 0 stock) so user can see what exists
    const items = await models.inventory.find(filter).sort({ name: 1 }).limit(40).lean()
    res.json({ items: items.map(fmtLean) })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Stock Movements (audit trail per item) ───────────────────────────────────
app.get('/api/stock-movements', async (req, res) => {
  try {
    const filter = {}
    if (req.query.inventoryId) filter.inventoryId = req.query.inventoryId
    if (req.query.type) filter.type = req.query.type
    const docs = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(200).lean()
    res.json(docs.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Account Heads / Balance Sheet summary ────────────────────────────────────
app.get('/api/account-heads', async (req, res) => {
  try {
    const [invItems, suppliers, clients, allSales, allPurchases] = await Promise.all([
      models.inventory.find().lean(),
      Contact.find({ type: 'supplier' }).lean(),
      Contact.find({ type: 'client' }).lean(),
      Sale.find({ status: 'confirmed' }).lean(),
      Purchase.find().lean(),
    ])

    const inventoryValue   = invItems.reduce((s, i) => s + (i.qty || 0) * (i.costPrice || 0), 0)
    // AP: supplier balance where credit > debit (we owe them = negative balance)
    const accountsPayable  = suppliers.reduce((s, c) => {
      const bal = c.currentBalance || 0
      return s + (bal < 0 ? Math.abs(bal) : 0)
    }, 0)
    // AR: client balance where debit > credit (they owe us = positive balance)
    const accountsReceivable = clients.reduce((s, c) => {
      const bal = c.currentBalance || 0
      return s + (bal > 0 ? bal : 0)
    }, 0)

    const salesRevenue  = allSales.reduce((s, sale) => s + (sale.total || 0), 0)
    const cogs          = allSales.reduce((s, sale) => s + (sale.totalCost || 0), 0)
    const grossProfit   = salesRevenue - cogs
    const totalPurchases = allPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)
    const totalPurchasesPaid = allPurchases.reduce((s, p) => s + (p.paidAmount || 0), 0)

    res.json({
      inventoryValue,
      accountsPayable,
      accountsReceivable,
      salesRevenue,
      cogs,
      grossProfit,
      totalPurchases,
      totalPurchasesPaid,
      outstandingPayable: totalPurchases - totalPurchasesPaid,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

OTHER_COLLECTIONS.filter(n => n !== 'dayBook' && n !== 'supplyOrders').forEach(name => {
  app.post(`/api/${name}`, async (req, res) => {
    try { res.json(fmt(await models[name].create(req.body))) }
    catch (err) { res.status(500).json({ error: err.message }) }
  })
  app.put(`/api/${name}/:id`, async (req, res) => {
    try {
      const doc = await models[name].findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true }).lean()
      if (!doc) return res.status(404).json({ error: 'Not found' })
      res.json(fmtLean(doc))
    } catch (err) { res.status(500).json({ error: err.message }) }
  })
  app.delete(`/api/${name}/:id`, async (req, res) => {
    try { await models[name].findOneAndDelete({ id: req.params.id }); res.json({ ok: true }) }
    catch (err) { res.status(500).json({ error: err.message }) }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/users/employees', async (req, res) => {
  try {
    if (await User.findOne({ username: req.body.username })) return res.status(400).json({ error: 'Username already taken.' })
    res.json(fmt(await User.create({ ...req.body, role: 'employee' })))
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.put('/api/users/employees/:id', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate({ id: req.params.id, role: 'employee' }, { $set: req.body }, { new: true })
    if (!user) return res.status(404).json({ error: 'Not found' })
    res.json(fmt(user))
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.delete('/api/users/employees/:id', async (req, res) => {
  try { await User.findOneAndDelete({ id: req.params.id, role: 'employee' }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})
app.delete('/api/users/clients/:id', async (req, res) => {
  try { await User.findOneAndDelete({ id: req.params.id, role: 'client' }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})
app.put('/api/users/admin', async (req, res) => {
  try { await User.findOneAndUpdate({ role: 'admin' }, { $set: req.body }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SINGLETONS
// ═══════════════════════════════════════════════════════════════════════════════

app.put('/api/wallets', async (req, res) => {
  try { await Singleton.findOneAndUpdate({ key: 'wallets' }, { value: req.body }, { upsert: true }); res.json(req.body) }
  catch (err) { res.status(500).json({ error: err.message }) }
})
app.put('/api/settings', async (req, res) => {
  try { await Singleton.findOneAndUpdate({ key: 'settings' }, { value: req.body }, { upsert: true }); res.json(req.body) }
  catch (err) { res.status(500).json({ error: err.message }) }
})
app.put('/api/master-code', async (req, res) => {
  try { await Singleton.findOneAndUpdate({ key: 'masterCode' }, { value: req.body.masterCode }, { upsert: true }); res.json({ ok: true }) }
  catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SPA FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => console.log(`🚀 Tataheer ERP server running on port ${PORT}`))
