import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
// Cloudinary & Multer loaded dynamically to avoid ESM issues
import { createRequire } from 'module'
const require = createRequire(import.meta.url)

let cloudinary, multerUpload
try {
  const cloudinaryPkg = await import('cloudinary')
  cloudinary = cloudinaryPkg.v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  const multerPkg = await import('multer')
  const multer = multerPkg.default
  multerUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
  console.log('✅ Cloudinary connected')
} catch (e) {
  console.warn('⚠️ Cloudinary not available:', e.message)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
if (!process.env.VERCEL) {
  app.use(express.static(join(__dirname, 'dist')))
}

// ─── CONNECT MONGODB ──────────────────────────────────────────────────────────
// Reuse connection across Vercel serverless invocations
mongoose.set('bufferTimeoutMS', 30000)  // match our connection timeout
const dbConnectPromise = mongoose.connection.readyState === 0
  ? mongoose.connect(process.env.DATABASE_URL, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 60000,
      connectTimeoutMS: 30000,
    })
      .then(() => console.log('✅ MongoDB Atlas connected'))
      .catch(err => console.error('❌ MongoDB connection error:', err))
  : Promise.resolve()

// Wait for DB before handling any request (critical for Vercel cold starts)
app.use(async (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next()
  try { await dbConnectPromise } catch (_) {}
  next()
})

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

// ── Attachment (Cloudinary file refs) ────────────────────────────────────────
const Attachment = mongoose.model('Attachment', new mongoose.Schema({
  id: String, url: String, publicId: String, originalName: String,
  fileType: String, size: Number, refId: String, refType: String,
  uploadedBy: String, folder: String,
}, { strict: false, timestamps: true }))

// ── User ──────────────────────────────────────────────────────────────────────
const User = mongoose.model('User', new mongoose.Schema({
  id:            { type: String, index: true },
  username:      { type: String, unique: true, sparse: true },
  password:      String,
  name:          String,
  role:          { type: String, enum: ['admin', 'employee', 'client'] },
  phone:         String,
  email:         String,
  company:       String,
  address:       String,
  active:        Boolean,
  hidden:        { type: Boolean, default: false },
  empRole:       String,
  loginAttempts: { type: Number, default: 0 },
  lockedUntil:   Date,
  lastLogin:     Date,
  permissions:   { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true }))

// ── Audit Log ─────────────────────────────────────────────────────────────────
const AuditLog = mongoose.model('AuditLog', new mongoose.Schema({
  id:       String,
  userName: String,
  userRole: String,
  action:   String,
  detail:   String,
  ip:       String,
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

// ── Auto-register contact if name not found ───────────────────────────────────
// Returns the accountHeadID (existing or newly created)
async function autoRegisterContact(name, type, phone = '', companyId = 'TAT') {
  if (!name || !name.trim()) return null
  const trimmed = name.trim()
  // Match by BOTH name AND type — prevents a client and supplier with the same
  // name from sharing an accountHeadID and cross-contaminating each other's ledger.
  const safeRegex = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const existing = await Contact.findOne({
    name: { $regex: `^${safeRegex}$`, $options: 'i' },
    type,   // ← strict type guard: client stays client, supplier stays supplier
  }).lean()
  if (existing) return existing.accountHeadID
  // Create new contact
  const accountHeadID = await generateAccountHeadID(type)
  await Contact.create({
    id: Date.now().toString(),
    accountHeadID,
    type,
    name: trimmed,
    phone: phone || '',
    email: '',
    address: '',
    openingBalance: 0,
    currentBalance: 0,
    companyId,
  })
  console.log(`✅ Auto-registered ${type}: ${trimmed} → ${accountHeadID}`)
  return accountHeadID
}

// ── Ledger trigger: create entry + update contact balance ─────────────────────
// ── Single-source-of-truth balance: Σdebit − Σcredit across ALL ledger entries
async function computeLiveBalance(accountHeadID) {
  const agg = await Ledger.aggregate([
    { $match: { accountHeadID } },
    { $group: { _id: null, totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' } } },
  ])
  return agg.length > 0 ? (agg[0].totalDebit - agg[0].totalCredit) : null
}

async function postLedgerEntry({ accountHeadID, contactName, date, description, documentRef, documentType, debit, credit }) {
  if (!accountHeadID) return

  // Running balance for the per-row balance column in ledger statement view
  const lastEntry = await Ledger.findOne({ accountHeadID }).sort({ createdAt: -1 }).lean()
  const prevRunning = lastEntry?.balance || 0
  const runningBalance = prevRunning + debit - credit

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
    balance: runningBalance,
  })

  // ── Live aggregate balance (single source of truth) ─────────────────────────
  // Computed AFTER the new entry is written so it's included in the sum
  const liveBalance = await computeLiveBalance(accountHeadID)
  if (liveBalance !== null) {
    await Contact.findOneAndUpdate(
      { accountHeadID },
      { $set: { currentBalance: liveBalance } }
    )
  }

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
    await Singleton.findOneAndUpdate({ key: 'securitySettings' }, { $setOnInsert: { value: { sessionTimeout: 30, maxLoginAttempts: 5, lockDuration: 15, recoveryPin: '1234', backupCode: 'TAT-2026-RESET' } } }, { upsert: true })
    // ── Companies (multi-company support) ─────────────────────────────────────
    await Singleton.findOneAndUpdate({ key: 'companies' }, { $setOnInsert: { value: [
      { id: 'TAT', name: 'Tataheer Traders', invoiceCounter: 201, quotationPrefix: 'QUO', soPrefix: 'SO', dnPrefix: 'DN', address: '426- Ali Arcade, 13-km Main Multan Road, Lahore', phone: '+92(314)4094900', email: 'tataheertraders@gmail.com', active: true },
      { id: 'INF', name: 'Infinity Corp', invoiceCounter: 180, quotationPrefix: 'QUO', soPrefix: 'SO', dnPrefix: 'DN', address: '101- Choudery Plaza Royal Park Lahore', phone: '+92-314-855-5566', email: 'infinity.crop512@gmail.com', active: true },
    ]}}, { upsert: true })
    // Force-update INF contact details + backfill per-company wallets + fix invoice counters
    {
      const doc = await Singleton.findOne({ key: 'companies' }).lean()
      if (doc) {
        // Find the highest existing INV-xxx number in the database
        const lastInv = await Invoice.findOne(
          { number: /^INV-\d+$/ }, { number: 1 }
        ).sort({ number: -1 }).lean()
        const highestInvNum = lastInv
          ? (parseInt(lastInv.number.replace('INV-', '')) || 0)
          : 0

        // Minimum floor per company (never go below this)
        const FLOOR = { TAT: 201, INF: 180 }

        const updated = (doc.value || []).map(c => {
          const floor   = FLOOR[c.id] || 201
          // Counter must be > highest existing number AND >= floor
          const minNext = Math.max(floor, highestInvNum + 1)
          const counter = Math.max(c.invoiceCounter || 0, minNext)
          return {
            ...c,
            invoiceCounter: counter,
            // Ensure every company has its own wallets bucket
            wallets: c.wallets || { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 },
            ...(c.id === 'INF' ? {
              address: '101- Choudery Plaza Royal Park Lahore',
              phone: '+92-314-855-5566',
              email: 'infinity.crop512@gmail.com',
            } : {}),
          }
        })
        await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated })
        const tatCounter = updated.find(c => c.id === 'TAT')?.invoiceCounter
        console.log(`✅ TAT invoiceCounter synced to ${tatCounter} (highest existing: INV-${highestInvNum})`)
      }
    }
    await User.findOneAndUpdate(
      { role: 'admin' },
      { $set: { username: process.env.ADMIN_USER || 'admin', password: process.env.ADMIN_PASSWORD || 'admin123', name: 'Administrator', role: 'admin' }, $setOnInsert: { id: 'admin' } },
      { upsert: true }
    )
    console.log('✅ Database defaults initialized')
    // ── Repair any drifted currentBalance fields from live ledger on startup ───
    setImmediate(repairAllContactBalances)
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
    const secDoc = await Singleton.findOne({ key: 'securitySettings' }).lean()
    const sec = secDoc?.value || { maxLoginAttempts: 5, lockDuration: 15 }

    const user = await User.findOne({ username })
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' })

    // Check hidden
    if (user.hidden) return res.status(401).json({ error: 'Account hidden. Contact administrator.' })
    // Check disabled
    if (user.role !== 'admin' && user.active === false) return res.status(401).json({ error: 'Account disabled. Contact admin.' })
    // Check locked
    if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
      const mins = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000)
      return res.status(401).json({ error: `Account locked. Try again in ${mins} minute(s).` })
    }

    // Wrong password
    if (user.password !== password) {
      const attempts = (user.loginAttempts || 0) + 1
      const update = { loginAttempts: attempts }
      if (attempts >= sec.maxLoginAttempts) {
        update.lockedUntil = new Date(Date.now() + (sec.lockDuration || 15) * 60000)
        update.loginAttempts = 0
        await User.findByIdAndUpdate(user._id, { $set: update })
        await AuditLog.create({ id: Date.now().toString(), userName: username, userRole: user.role, action: 'account_locked', detail: `Locked after ${sec.maxLoginAttempts} failed attempts`, ip: req.ip })
        return res.status(401).json({ error: `Too many failed attempts. Account locked for ${sec.lockDuration || 15} minutes.` })
      }
      await User.findByIdAndUpdate(user._id, { $set: update })
      await AuditLog.create({ id: Date.now().toString(), userName: username, userRole: user.role, action: 'login_failed', detail: `Failed attempt ${attempts}/${sec.maxLoginAttempts}`, ip: req.ip })
      return res.status(401).json({ error: `Invalid password. ${sec.maxLoginAttempts - attempts} attempt(s) remaining.` })
    }

    // Success
    await User.findByIdAndUpdate(user._id, { $set: { loginAttempts: 0, lockedUntil: null, lastLogin: new Date() } })
    await AuditLog.create({ id: Date.now().toString(), userName: user.name, userRole: user.role, action: 'login', detail: 'Logged in successfully', ip: req.ip })
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

// Get all contacts — currentBalance is always computed live from Ledger
app.get('/api/contacts', async (req, res) => {
  try {
    const filter = req.query.type ? { type: req.query.type } : {}
    const contacts = await Contact.find(filter).sort({ createdAt: -1 }).lean()

    // ── Live balance aggregation: single source of truth ─────────────────────
    const accountIds = contacts.map(c => c.accountHeadID).filter(Boolean)
    const ledgerAgg = await Ledger.aggregate([
      { $match: { accountHeadID: { $in: accountIds } } },
      { $group: {
          _id: '$accountHeadID',
          totalDebit:  { $sum: '$debit' },
          totalCredit: { $sum: '$credit' },
      }},
    ])
    const ledgerMap = {}
    ledgerAgg.forEach(r => { ledgerMap[r._id] = r.totalDebit - r.totalCredit })

    const enriched = contacts.map(c => {
      // Use live ledger net if entries exist; else fall back to stored currentBalance
      const liveBalance = c.accountHeadID && ledgerMap[c.accountHeadID] !== undefined
        ? ledgerMap[c.accountHeadID]
        : (c.currentBalance || 0)
      return { ...c, currentBalance: liveBalance }
    })

    res.json({ contacts: enriched.map(fmtLean) })
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

// ── Repair: backfill currentBalance on all contacts from live ledger aggregate ─
// Runs once at startup and is also callable via POST /api/ledger/repair-balances
async function repairAllContactBalances() {
  try {
    const agg = await Ledger.aggregate([
      { $group: { _id: '$accountHeadID', totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' } } },
    ])
    await Promise.all(agg.map(r =>
      Contact.findOneAndUpdate(
        { accountHeadID: r._id },
        { $set: { currentBalance: r.totalDebit - r.totalCredit } }
      )
    ))
    console.log(`[repair] Resynced currentBalance for ${agg.length} account(s) from live ledger.`)
  } catch (err) { console.error('[repair] Balance repair failed:', err.message) }
}
app.post('/api/ledger/repair-balances', async (_req, res) => {
  await repairAllContactBalances()
  res.json({ ok: true, message: 'Balance repair complete' })
})

// Get ledger for an account — balance is always live aggregate
app.get('/api/ledger/:accountHeadID', async (req, res) => {
  try {
    const { accountHeadID } = req.params
    const entries = await Ledger.find({ accountHeadID }).sort({ createdAt: 1 }).lean()
    const contact = await Contact.findOne({ accountHeadID }).lean()
    const liveBalance = await computeLiveBalance(accountHeadID)
    const currentBalance = liveBalance !== null ? liveBalance : (contact?.currentBalance || 0)
    res.json({
      contact: contact ? fmtLean(contact) : null,
      entries: entries.map(fmtLean),
      currentBalance,
    })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Manual ledger entry
app.post('/api/ledger', async (req, res) => {
  try {
    // Dedup guard: reject identical ledger entries posted within 5 seconds
    const fiveSec = new Date(Date.now() - 5000)
    const dupe = await Ledger.findOne({
      accountHeadID: req.body.accountHeadID,
      debit:         parseFloat(req.body.debit)  || 0,
      credit:        parseFloat(req.body.credit) || 0,
      description:   req.body.description,
      createdAt:     { $gte: fiveSec },
    }).lean()
    if (dupe) return res.json(fmtLean(dupe))
    const entry = await postLedgerEntry(req.body)
    res.json(fmt(entry))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Reassign accountHeadID (migrates ledger, invoices, purchases, sales) ──────
app.put('/api/contacts/:id/reassign-id', async (req, res) => {
  try {
    const { newAccountHeadID } = req.body
    if (!newAccountHeadID) return res.status(400).json({ error: 'newAccountHeadID required' })

    const contact = await Contact.findOne({ id: req.params.id }).lean()
    if (!contact) return res.status(404).json({ error: 'Contact not found' })

    // Check if target ID is already taken by another contact
    const clash = await Contact.findOne({ accountHeadID: newAccountHeadID }).lean()
    if (clash && clash.id !== req.params.id) {
      return res.status(400).json({ error: `${newAccountHeadID} is already assigned to "${clash.name}"` })
    }

    const oldID = contact.accountHeadID

    // Swap if the target ID belongs to another contact (exchange IDs)
    if (clash && clash.id !== req.params.id) {
      await Contact.findOneAndUpdate({ id: clash.id }, { $set: { accountHeadID: oldID } })
      await Ledger.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: '__tmp__' } })
      await Ledger.updateMany({ accountHeadID: newAccountHeadID }, { $set: { accountHeadID: oldID } })
      await Ledger.updateMany({ accountHeadID: '__tmp__' }, { $set: { accountHeadID: newAccountHeadID } })
      await Invoice.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: '__tmp__' } })
      await Invoice.updateMany({ accountHeadID: newAccountHeadID }, { $set: { accountHeadID: oldID } })
      await Invoice.updateMany({ accountHeadID: '__tmp__' }, { $set: { accountHeadID: newAccountHeadID } })
    } else {
      // Simple rename — migrate by accountHeadID
      await Ledger.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: newAccountHeadID } })
      await Invoice.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: newAccountHeadID } })
      await Purchase.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: newAccountHeadID } })
      await Sale.updateMany({ accountHeadID: oldID }, { $set: { accountHeadID: newAccountHeadID } })

      // Also backfill legacy records that have no accountHeadID but match by contactName
      if (contact.name) {
        const nameRx = new RegExp(`^${contact.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        const noID   = { $in: [null, '', undefined] }
        await Invoice.updateMany(
          { clientName: nameRx, accountHeadID: noID },
          { $set: { accountHeadID: newAccountHeadID } }
        )
        await Ledger.updateMany(
          { contactName: nameRx, accountHeadID: noID },
          { $set: { accountHeadID: newAccountHeadID } }
        )
        await Sale.updateMany(
          { contactName: nameRx, accountHeadID: noID },
          { $set: { accountHeadID: newAccountHeadID } }
        )
        await Purchase.updateMany(
          { supplierName: nameRx, accountHeadID: noID },
          { $set: { accountHeadID: newAccountHeadID } }
        )
      }
    }

    const updated = await Contact.findOneAndUpdate(
      { id: req.params.id },
      { $set: { accountHeadID: newAccountHeadID } },
      { new: true }
    ).lean()

    res.json({ ok: true, contact: fmtLean(updated), oldID, newID: newAccountHeadID })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Standalone supplier payment (not tied to a purchase record) ───────────────
// Used by Ledger module PaySupplier flow via UniversalPaymentModal
app.post('/api/contacts/:id/pay-supplier', async (req, res) => {
  try {
    const { amount, grossAmount: bodyGross, netAmount, whtPct = 0, whtAmount = 0, wallet, date, reference, notes } = req.body
    const gross = parseFloat(bodyGross || amount) || 0
    const net   = parseFloat(netAmount) ?? gross
    const wht   = parseFloat(whtAmount) || 0
    const pct   = parseFloat(whtPct) || 0
    if (gross <= 0) return res.status(400).json({ error: 'Amount must be > 0' })

    const contact = await Contact.findOne({ id: req.params.id }).lean()
    if (!contact) return res.status(404).json({ error: 'Contact not found' })

    const txDate = date || new Date().toISOString().slice(0, 10)
    const docRef = reference || `PAY-${Date.now().toString().slice(-6)}`

    // Ledger: debit supplier (reduces AP)
    await postLedgerEntry({
      accountHeadID: contact.accountHeadID,
      contactName:   contact.name,
      date:          txDate,
      description:   `Payment to ${contact.name}${notes ? ': ' + notes : ''}${wht > 0 ? ` (WHT ${pct}% = PKR ${wht})` : ''}`,
      documentRef:   docRef,
      documentType:  'payment',
      debit:         gross,
      credit:        0,
    })

    // DayBook: net cash out of wallet
    await models.dayBook.create({
      id: Date.now().toString(), date: txDate, type: 'expense',
      category: 'Supplier Payment',
      description: `Paid to ${contact.name}${notes ? ' — ' + notes : ''}`,
      partyName: contact.name, accountHeadID: contact.accountHeadID,
      reference: docRef, wallet: wallet || 'Cash',
      debit: 0, credit: net,
      companyId: contact.companyId || 'TAT',
    })

    // WHT entry
    if (wht > 0) {
      await models.dayBook.create({
        id:           (Date.now() + 1).toString(),
        date:         txDate,
        type:         'expense',
        category:     'WHT Payable (Tax)',
        description:  `WHT ${pct}% on payment to ${contact.name}`,
        partyName:    contact.name,
        accountHeadID: contact.accountHeadID || '',
        taxHeadID:    'TAX-WHT',
        reference:    docRef,
        whtPct:       pct,
        grossAmount:  gross,
        wallet:       'Tax Head',
        partyType:    'supplier',
        challanStatus: 'pending',
        debit:        0,
        credit:       wht,
        notes:        notes || '',
        companyId:    contact.companyId || 'TAT',
      })
    }

    res.json({ ok: true, gross, net, wht, status: 'paid' })
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
    // ── Sanitise invoice number ───────────────────────────────────────────────
    // Guard against "[object Promise]" or blank numbers saved by old client bug.
    // If number is bad, auto-generate a safe unique one before inserting.
    let safeNumber = req.body.number
    const isBad = !safeNumber
      || String(safeNumber).includes('[object')
      || String(safeNumber).trim() === ''
    if (isBad) {
      // Find the highest existing INV-xxx by numeric value
      const all = await Invoice.find({ number: /^INV-\d+$/ }, { number: 1 }).lean()
      const lastNum = all.reduce((max, inv) => {
        const n = parseInt(inv.number.replace('INV-', '')) || 0
        return Math.max(max, n)
      }, 200)
      safeNumber = `INV-${lastNum + 1}`
      // Also bump the company counter so next auto-number is consistent
      const cid = req.body.companyId || 'TAT'
      const cDoc = await Singleton.findOne({ key: 'companies' }).lean()
      if (cDoc) {
        const updated = (cDoc.value || []).map(c =>
          c.id === cid ? { ...c, invoiceCounter: Math.max((c.invoiceCounter || 0), lastNum + 2) } : c
        )
        await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated })
      }
    }
    // Auto-register client if not already in contacts
    let accountHeadID = req.body.accountHeadID
    if (!accountHeadID && req.body.clientName) {
      accountHeadID = await autoRegisterContact(req.body.clientName, 'client', req.body.clientContact, req.body.companyId)
    }

    const invoice = await Invoice.create({ ...req.body, number: safeNumber, accountHeadID: accountHeadID || req.body.accountHeadID })

    // ── LEDGER TRIGGER ────────────────────────────────────────────────────────
    if (accountHeadID && req.body.total > 0) {
      await postLedgerEntry({
        accountHeadID,
        contactName:   req.body.clientName,
        date:          req.body.date,
        description:   `Invoice: ${safeNumber}`,
        documentRef:   safeNumber,
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

// ── One-time cleanup: fix any invoices saved with "[object Promise]" number ───
app.post('/api/invoices/fix-bad-numbers', async (req, res) => {
  try {
    const bad = await Invoice.find({
      $or: [
        { number: { $regex: '\\[object' } },
        { number: '' },
        { number: { $exists: false } },
        { number: null },
      ]
    }).lean()

    let fixed = 0
    for (const inv of bad) {
      // Find highest existing INV-xxx
      const last = await Invoice.findOne(
        { number: /^INV-\d+$/ }, { number: 1 }
      ).sort({ number: -1 }).lean()
      const lastNum = last ? (parseInt(last.number.replace('INV-', '')) || 200) : 200
      const newNum = `INV-${lastNum + 1}`
      await Invoice.findOneAndUpdate(
        { _id: inv._id },
        { $set: { number: newNum } }
      )
      fixed++
    }
    res.json({ ok: true, fixed, message: `Fixed ${fixed} invoice(s) with bad numbers` })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Record payment against an invoice (marks paid/partial + ledger + dayBook) ─
app.post('/api/invoices/:id/payment', async (req, res) => {
  try {
    const { amount, grossAmount: bodyGross, netAmount, whtPct = 0, whtAmount = 0, wallet, date, reference, notes } = req.body
    const gross = parseFloat(bodyGross || amount) || 0   // clears balance
    const net   = parseFloat(netAmount) ?? gross          // hits wallet
    const wht   = parseFloat(whtAmount) || 0
    const pct   = parseFloat(whtPct) || 0
    if (gross <= 0) return res.status(400).json({ error: 'Amount must be > 0' })

    const invoice = await Invoice.findOne({ id: req.params.id }).lean()
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' })

    const prevPaid   = parseFloat(invoice.advancePaid) || 0
    const total      = parseFloat(invoice.total) || 0
    const newPaid    = prevPaid + gross    // gross clears invoice balance
    const newBalance = total - newPaid
    const newStatus  = newBalance <= 0 ? 'paid' : 'partial'

    const updated = await Invoice.findOneAndUpdate(
      { id: req.params.id },
      { $set: { advancePaid: newPaid, balance: Math.max(newBalance, 0), status: newStatus } },
      { new: true }
    ).lean()

    const txDate = date || new Date().toISOString().slice(0, 10)

    // ── Ledger: credit client account (gross — full obligation settled) ─────────
    if (invoice.accountHeadID) {
      await postLedgerEntry({
        accountHeadID: invoice.accountHeadID,
        contactName:   invoice.clientName,
        date:          txDate,
        description:   `Payment received for ${invoice.number}${wht > 0 ? ` (WHT ${pct}% = PKR ${wht})` : ''}`,
        documentRef:   invoice.number,
        documentType:  'payment',
        debit:         0,
        credit:        gross,
      })
    }

    // ── DayBook: net amount received into wallet ───────────────────────────────
    await models.dayBook.create({
      id:          Date.now().toString(),
      date:        txDate,
      type:        'income',
      category:    'Client Payment',
      description: `Payment received: ${invoice.number} from ${invoice.clientName || 'Client'}`,
      partyName:   invoice.clientName || '',
      accountHeadID: invoice.accountHeadID || '',
      reference:   reference || invoice.number,
      debit:       net,
      credit:      0,
      wallet:      wallet || 'Cash',
      notes:       notes || '',
      companyId:   invoice.companyId || 'TAT',
    })

    // ── WHT: post to tax head if applicable ───────────────────────────────────
    if (wht > 0) {
      await models.dayBook.create({
        id:           (Date.now() + 1).toString(),
        date:         txDate,
        type:         'income',
        category:     'WHT Deducted (Tax)',
        description:  `WHT ${pct}% on ${invoice.number} — ${invoice.clientName}`,
        partyName:    invoice.clientName || '',
        accountHeadID: invoice.accountHeadID || '',
        taxHeadID:    'TAX-WHT',
        reference:    invoice.number,
        whtPct:       pct,
        grossAmount:  gross,
        debit:        wht,
        credit:       0,
        wallet:       'Tax Head',
        partyType:    'client',
        challanStatus: 'pending',
        notes:        notes || '',
        companyId:    invoice.companyId || 'TAT',
      })
    }

    // ── Rule 1: if now fully paid, auto-set all linked Delivery Notes → delivered
    if (newStatus === 'paid' && invoice.number) {
      await models.deliveryNotes.updateMany(
        { invoiceRef: invoice.number },
        { $set: { status: 'delivered' } }
      )
    }

    res.json({ ok: true, invoice: fmtLean(updated), newPaid, newBalance: Math.max(newBalance, 0), status: newStatus })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Rule 1b: when a DN status → delivered, check if all DNs for its invoice are
//    delivered and auto-close the invoice delivery tracking ─────────────────────
app.post('/api/delivery-notes/:id/sync-invoice', async (req, res) => {
  try {
    const dn = await models.deliveryNotes.findOne({ id: req.params.id }).lean()
    if (!dn?.invoiceRef) return res.json({ ok: true, synced: false })
    const allDNs = await models.deliveryNotes.find({ invoiceRef: dn.invoiceRef }).lean()
    const allDelivered = allDNs.length > 0 && allDNs.every(d => d.status === 'delivered')
    res.json({ ok: true, synced: allDelivered, allDelivered, dnCount: allDNs.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// GET version — called by frontend after payment to check if all DNs delivered
app.get('/api/delivery-notes/sync-check', async (req, res) => {
  try {
    const { invoiceRef } = req.query
    if (!invoiceRef) return res.json({ allDelivered: false, dnCount: 0 })
    const allDNs = await models.deliveryNotes.find({ invoiceRef }).lean()
    const allDelivered = allDNs.length > 0 && allDNs.every(d => d.status === 'delivered')
    res.json({ allDelivered, dnCount: allDNs.length })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  DAYBOOK  (with auto ledger trigger for payments)
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/dayBook', async (req, res) => {
  try {
    // Idempotency: return existing record if same id already saved
    if (req.body.id) {
      const existing = await models.dayBook.findOne({ id: req.body.id }).lean()
      if (existing) return res.json(fmtLean(existing))
    }
    const doc = await models.dayBook.create(req.body)

    // ── LEDGER TRIGGER — fires whenever a party account is linked ─────────────
    if (req.body.accountHeadID) {
      const debit  = parseFloat(req.body.debit)  || 0
      const credit = parseFloat(req.body.credit) || 0
      if (debit > 0 || credit > 0) {
        // ── Direction logic ───────────────────────────────────────────────────
        // DayBook "income" = money coming IN (debit in DayBook)
        //   → on client ledger this is a CREDIT (they paid us, AR reduces)
        // DayBook "expense" = money going OUT (credit in DayBook)
        //   → on supplier ledger this is a DEBIT (we paid them, AP reduces)
        // For manual entries with no type, pass through as-is.
        let ledgerDebit  = debit
        let ledgerCredit = credit
        const type = (req.body.type || '').toLowerCase()
        const cat  = (req.body.category || '').toLowerCase()
        if (type === 'income' && cat !== 'sale') {
          // Payment received from client → credit on their account
          ledgerDebit  = 0
          ledgerCredit = debit || credit
        } else if (type === 'expense' && cat !== 'purchase') {
          // Payment made to supplier → debit on their account
          ledgerDebit  = credit || debit
          ledgerCredit = 0
        }
        // 'sale' and 'purchase' auto-entries are handled by their own endpoints
        // and should not double-post here — skip them
        if (cat !== 'sale' && cat !== 'purchase' && cat !== 'client payment') {
          await postLedgerEntry({
            accountHeadID: req.body.accountHeadID,
            contactName:   req.body.partyName || req.body.description,
            date:          req.body.date,
            description:   req.body.description || 'Day Book Entry',
            documentRef:   req.body.reference  || doc.id,
            documentType:  'daybook',
            debit:  ledgerDebit,
            credit: ledgerCredit,
          })
        }
      }
    }

    res.json(fmt(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/dayBook/:id', async (req, res) => {
  try {
    const doc = await models.dayBook.findOneAndUpdate(
      { id: req.params.id },
      { $set: req.body },
      { new: true }
    ).lean()
    if (!doc) return res.status(404).json({ error: 'Not found' })
    res.json(fmtLean(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.delete('/api/dayBook/:id', async (req, res) => {
  try {
    const entry = await models.dayBook.findOne({ id: req.params.id }).lean()
    if (!entry) return res.status(404).json({ error: 'Not found' })

    // ── Auto-reverse ledger if this entry had an accountHeadID ─────────────────
    if (entry.accountHeadID) {
      const debit  = parseFloat(entry.debit)  || 0
      const credit = parseFloat(entry.credit) || 0
      if (debit > 0 || credit > 0) {
        // Re-apply the SAME direction logic used when the entry was originally posted,
        // so we know what was ACTUALLY written to the ledger, then reverse it.
        const type = (entry.type     || '').toLowerCase()
        const cat  = (entry.category || '').toLowerCase()
        let ledgerDebit = debit, ledgerCredit = credit
        if (type === 'income' && cat !== 'sale' && cat !== 'client payment') {
          ledgerDebit = 0; ledgerCredit = debit || credit
        } else if (type === 'expense' && cat !== 'purchase' && cat !== 'supplier payment') {
          ledgerDebit = credit || debit; ledgerCredit = 0
        }

        // Reverse: post exact opposite of what the ledger received
        await postLedgerEntry({
          accountHeadID: entry.accountHeadID,
          contactName:   entry.contactName || entry.partyName,
          date:          new Date().toISOString().slice(0, 10),
          description:   `[Reversed] ${entry.description}`,
          documentRef:   `REV-${entry.id}`,
          documentType:  'reversal',
          debit:  ledgerCredit,   // what was credited → debit back
          credit: ledgerDebit,    // what was debited  → credit back
        })
      }
    }

    await models.dayBook.findOneAndDelete({ id: req.params.id })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  LOAD ALL DATA  (initial page load)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/data', async (req, res) => {
  try {
    const result = {}
    // Company filter: TAT includes legacy records (no companyId), INF is strict
    const cid = req.query.company || 'TAT'
    const txFilter = cid === 'TAT'
      ? { $or: [{ companyId: 'TAT' }, { companyId: { $exists: false } }, { companyId: null }] }
      : { companyId: cid }

    // Contacts — SHARED across all companies
    const contacts = await Contact.find().sort({ createdAt: -1 }).lean()
    result.contacts = contacts.map(fmtLean)

    // Invoices — company-specific
    const invoices = await Invoice.find(txFilter).sort({ createdAt: -1 }).lean()
    result.invoices = invoices.map(fmtLean)

    // Purchases and Sales — company-specific
    const [purchases, sales] = await Promise.all([
      Purchase.find(txFilter).sort({ createdAt: -1 }).lean(),
      Sale.find(txFilter).sort({ createdAt: -1 }).lean(),
    ])
    result.purchases = purchases.map(fmtLean)
    result.sales     = sales.map(fmtLean)

    // Other collections — company-specific except inventory & calendarEvents (shared)
    const SHARED_COLLECTIONS = ['inventory', 'calendarEvents']
    for (const name of OTHER_COLLECTIONS) {
      const filter = SHARED_COLLECTIONS.includes(name) ? {} : txFilter
      const docs = await models[name].find(filter).sort({ createdAt: -1 }).lean()
      result[name] = docs.map(fmtLean)
    }

    // Users — SHARED
    const [employees, clients, admin] = await Promise.all([
      User.find({ role: 'employee' }).lean(),
      User.find({ role: 'client' }).lean(),
      User.findOne({ role: 'admin' }).lean(),
    ])
    result.users = {
      admin: { username: admin?.username || 'admin', password: admin?.password || 'admin123', name: admin?.name || 'Administrator', role: 'admin', lastLogin: admin?.lastLogin },
      employees: employees.map(fmtLean),
      clients:   clients.map(fmtLean),
    }

    // Singletons
    const [walletDoc, settingsDoc, masterDoc, secDoc, companiesDoc] = await Promise.all([
      Singleton.findOne({ key: 'wallets' }).lean(),
      Singleton.findOne({ key: 'settings' }).lean(),
      Singleton.findOne({ key: 'masterCode' }).lean(),
      Singleton.findOne({ key: 'securitySettings' }).lean(),
      Singleton.findOne({ key: 'companies' }).lean(),
    ])
    result.settings         = settingsDoc?.value || { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' }
    result.securitySettings = secDoc?.value      || { sessionTimeout: 30, maxLoginAttempts: 5, lockDuration: 15, recoveryPin: '1234', backupCode: 'TAT-2026-RESET' }
    result.masterCode       = masterDoc?.value   || '5555'
    result.companies        = companiesDoc?.value || []
    // Active company settings + per-company wallets
    const activeCompany = (companiesDoc?.value || []).find(c => c.id === cid)
    if (activeCompany) {
      result.settings = { ...result.settings, invoiceCounter: activeCompany.invoiceCounter, companyName: activeCompany.name }
      result.wallets  = activeCompany.wallets || { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 }
    } else {
      result.wallets = { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 }
    }

    res.json(result)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  GENERIC COLLECTION CRUD  (for remaining collections)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Supply Order — saved as procurement intent; ledger only posts on Purchase confirm ──
app.post('/api/supplyOrders', async (req, res) => {
  try {
    if (req.body.id) {
      const existing = await models.supplyOrders.findOne({ id: req.body.id }).lean()
      if (existing) return res.json(fmtLean(existing))
    }
    // Auto-register supplier if not already in contacts
    let accountHeadID = req.body.accountHeadID
    if (!accountHeadID && req.body.supplierName) {
      accountHeadID = await autoRegisterContact(req.body.supplierName, 'supplier', req.body.supplierContact, req.body.companyId)
    }
    const doc = await models.supplyOrders.create({ ...req.body, accountHeadID: accountHeadID || req.body.accountHeadID })
    res.json(fmt(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Supply Order UPDATE — was missing; caused all SO edits to silently fail ───
app.put('/api/supplyOrders/:id', async (req, res) => {
  try {
    // Re-resolve accountHeadID if supplier name changed
    let body = { ...req.body }
    if (body.supplierName && !body.accountHeadID) {
      body.accountHeadID = await autoRegisterContact(body.supplierName, 'supplier', body.supplierContact, body.companyId)
    }
    let doc = await models.supplyOrders.findOneAndUpdate(
      { id: req.params.id }, { $set: body }, { new: true }
    ).lean()
    if (!doc) {
      doc = await models.supplyOrders.findByIdAndUpdate(
        req.params.id, { $set: body }, { new: true }
      ).lean().catch(() => null)
    }
    if (!doc) return res.status(404).json({ error: 'Supply order not found' })
    res.json(fmtLean(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  PURCHASES  (Inward stock + Supplier AP ledger)
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: merge qty into existing inventory or create new item
// Fix 2: Weighted Average Cost (WAC) — never overwrites historical costPrice
// Fix 4: Transfers sellPrice from Supply Order to inventory on upsert
async function upsertInventoryItem({ description, color, qty, unit, costPrice, sellPrice = 0, supplierName, matrixRows }) {
  const safeDesc = description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let inv = await models.inventory.findOne({ name: { $regex: `^${safeDesc}$`, $options: 'i' } }).lean()
  if (inv) {
    // WAC: newAvg = (existingQty × existingCost + incomingQty × incomingCost) / newTotalQty
    const existingQty  = inv.qty || 0
    const existingCost = inv.costPrice || 0
    const newQty       = existingQty + qty
    const newAvgCost   = newQty > 0
      ? (existingQty * existingCost + qty * costPrice) / newQty
      : costPrice
    const totalCostValue = newQty * newAvgCost
    const update = {
      qty: newQty,
      costPrice: +newAvgCost.toFixed(4),
      totalCostValue: +totalCostValue.toFixed(4),
      updatedAt: new Date(),
    }
    // Only update sellPrice if the incoming value is explicitly set
    if (sellPrice > 0) update.sellPrice = sellPrice
    await models.inventory.findOneAndUpdate({ id: inv.id }, { $set: update })
    return inv
  }
  // Create new inventory item
  const newInv = await models.inventory.create({
    id: Date.now().toString() + Math.floor(Math.random() * 9999),
    name: description,
    color: color || '',
    category: 'Purchased',
    sku: `SKU-${Date.now().toString().slice(-6)}`,
    qty,
    unit: unit || 'pcs',
    costPrice,
    totalCostValue: qty * costPrice,
    sellPrice: sellPrice || 0,
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
    // Try custom id field first, then MongoDB _id (handles older records)
    let order = await models.supplyOrders.findOne({ id: req.params.soId }).lean()
    if (!order) {
      try { order = await models.supplyOrders.findById(req.params.soId).lean() } catch (_) {}
    }
    if (!order) return res.status(404).json({ error: 'Supply order not found' })
    if (order.purchaseRef) return res.status(400).json({ error: 'Already converted to purchase' })

    const count = await Purchase.countDocuments()
    const number = `PUR-${String(count + 1).padStart(4, '0')}`
    const purchaseDate = req.body.date || order.date || new Date().toISOString().slice(0, 10)

    let totalAmount = 0
    const purchaseItems = []
    const fulfillmentType = order.fulfillmentType || 'warehouse'  // Fix 3: default warehouse
    const isDirect = fulfillmentType === 'direct'

    for (const item of (order.items || [])) {
      const qty        = parseInt(item.qty) || 0
      // Fix 4: purchasePrice = cost to us (supplier side); marketPrice = selling price (client side)
      const costPrice  = parseFloat(item.purchasePrice || item.costPrice) || parseFloat(item.marketPrice) || 0
      const sellPrice  = parseFloat(item.marketPrice || item.sellingPrice) || 0
      const amount     = qty * costPrice
      totalAmount     += amount

      if (item.isService || isDirect) {
        // ── Fix 1 / Fix 3: SERVICE or DIRECT — bypass inventory & stock movement ──
        purchaseItems.push({
          description:  item.description,
          color:        item.color || '',
          qty,
          unit:         item.unit || 'pcs',
          costPrice,
          sellPrice,
          amount,
          inventoryId:  null,
          isService:    !!item.isService,
          matrixRows:   item.matrixRows || [],
        })
      } else {
        // ── WAREHOUSE: upsert inventory (WAC) + stock movement ────────────────
        const inv = await upsertInventoryItem({
          description:  item.description,
          color:        item.color || '',
          qty,
          unit:         item.unit || 'pcs',
          costPrice,
          sellPrice,                          // Fix 4: transfer agreed sell price
          supplierName: order.supplierName,
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
          notes:        `From SO ${order.number}`,
        })

        purchaseItems.push({
          description:  item.description,
          color:        item.color || '',
          qty,
          unit:         item.unit || 'pcs',
          costPrice,
          sellPrice,
          amount,
          inventoryId:  inv.id,
          isService:    false,
          matrixRows:   item.matrixRows || [],
        })
      }
    }

    // Create Purchase record
    const purchase = await Purchase.create({
      id: Date.now().toString(),
      number,
      supplyOrderId:        order.id,
      supplyOrderNumber:    order.number,
      supplierName:         order.supplierName,
      supplierContact:      order.supplierContact,
      accountHeadID:        order.accountHeadID,
      date:                 purchaseDate,
      items:                purchaseItems,
      totalAmount,
      paidAmount:           0,
      paymentStatus:        'unpaid',
      notes:                req.body.notes || order.notes || '',
      status:               'received',
      fulfillmentType,                          // Fix 3: store fulfillment mode
      clientAccountHeadID:  order.clientAccountHeadID || '',
      clientInvoiceRef:     order.clientInvoiceRef    || '',
    })

    // Mark supply order as delivered
    let soUpdated = await models.supplyOrders.findOneAndUpdate(
      { id: req.params.soId }, { $set: { status: 'delivered', purchaseRef: number } }, { new: true }
    )
    if (!soUpdated) {
      try { await models.supplyOrders.findByIdAndUpdate(req.params.soId, { $set: { status: 'delivered', purchaseRef: number } }) } catch (_) {}
    }

    // ── Fix 3: Link invoice if pre-specified on direct SO ────────────────────
    if (isDirect && order.clientInvoiceRef) {
      await Invoice.findOneAndUpdate(
        { number: order.clientInvoiceRef },
        { $set: { purchaseRef: number } }
      )
    }

    // ── SUPPLIER LEDGER: Credit = goods received (AP — we owe supplier) ──────
    // If accountHeadID is missing on the SO (e.g. SO was saved before supplier
    // was filled in, or the edit failed to persist), look it up / auto-register now.
    let supplierAccountHeadID = order.accountHeadID
    if (!supplierAccountHeadID && order.supplierName) {
      supplierAccountHeadID = await autoRegisterContact(
        order.supplierName, 'supplier', order.supplierContact, order.companyId
      )
      // Patch the SO record so future operations have it
      await models.supplyOrders.findOneAndUpdate(
        { id: order.id }, { $set: { accountHeadID: supplierAccountHeadID } }
      )
    }
    if (supplierAccountHeadID && totalAmount > 0) {
      await postLedgerEntry({
        accountHeadID: supplierAccountHeadID,
        contactName:   order.supplierName,
        date:          purchaseDate,
        description:   `${isDirect ? 'Direct/B2B' : 'Stock'} Purchase: ${number} (SO: ${order.number})`,
        documentRef:   number,
        documentType:  'purchase',
        debit:         0,
        credit:        totalAmount,
      })
    }

    // ── DAY BOOK: expense entry → AP (same for both warehouse and direct) ─────
    await models.dayBook.create({
      id:          Date.now().toString(),
      date:        purchaseDate,
      type:        'expense',
      category:    isDirect ? 'COGS - Direct Fulfilment' : 'Purchase',
      description: isDirect
        ? `Direct/B2B Purchase: ${number} from ${order.supplierName} (SO: ${order.number})`
        : `Stock Received: ${number} from ${order.supplierName} (SO: ${order.number})`,
      partyName:   order.supplierName,
      reference:   number,
      credit:      totalAmount,
      debit:       0,
      wallet:      'Accounts Payable',
      companyId:   order.companyId || req.body.companyId || 'TAT',
    })

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

    const fulfillmentType = req.body.fulfillmentType || 'warehouse'  // Fix 3
    const isDirect = fulfillmentType === 'direct'

    for (const item of (req.body.items || [])) {
      const qty       = parseInt(item.qty) || 0
      const costPrice = parseFloat(item.costPrice) || 0
      const sellPrice = parseFloat(item.sellPrice) || 0   // Fix 4
      const amount    = qty * costPrice
      totalAmount    += amount

      if (item.isService || isDirect) {
        // Fix 1 / Fix 3: bypass inventory for service items or direct fulfilment
        purchaseItems.push({ ...item, qty, costPrice, sellPrice, amount, inventoryId: null, isService: !!item.isService })
      } else {
        const inv = await upsertInventoryItem({
          description:  item.description,
          color:        item.color || '',
          qty,
          unit:         item.unit || 'pcs',
          costPrice,
          sellPrice,                           // Fix 4: carry agreed sell price
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

        purchaseItems.push({ ...item, qty, costPrice, sellPrice, amount, inventoryId: inv.id, isService: false })
      }
    }

    const purchase = await Purchase.create({
      ...req.body,
      id: Date.now().toString(),
      number,
      items: purchaseItems,
      totalAmount,
      fulfillmentType,
    })

    if (req.body.accountHeadID && totalAmount > 0) {
      await postLedgerEntry({
        accountHeadID: req.body.accountHeadID,
        contactName:   req.body.supplierName,
        date:          purchaseDate,
        description:   `${isDirect ? 'Direct/B2B' : ''} Purchase: ${number}`,
        documentRef:   number,
        documentType:  'purchase',
        debit:         0,
        credit:        totalAmount,
      })
    }

    // ── DAY BOOK: Auto-entry ──────────────────────────────────────────────────
    await models.dayBook.create({
      id:          Date.now().toString(),
      date:        purchaseDate,
      type:        'expense',
      category:    isDirect ? 'COGS - Direct Fulfilment' : 'Purchase',
      description: `${isDirect ? 'Direct/B2B' : 'Direct'} Purchase: ${number} from ${req.body.supplierName || 'Supplier'}`,
      partyName:   req.body.supplierName || '',
      reference:   number,
      credit:      totalAmount,
      debit:       0,
      wallet:      'Accounts Payable',
      companyId:   req.body.companyId || 'TAT',
    })

    res.json(fmt(purchase))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ── Record payment to supplier (marks paid/partial + ledger + dayBook) ─────────
app.post('/api/purchases/:id/payment', async (req, res) => {
  try {
    const { amount, grossAmount: bodyGross, netAmount, whtPct = 0, whtAmount = 0, wallet, date, reference, notes } = req.body
    const gross = parseFloat(bodyGross || amount) || 0
    const net   = parseFloat(netAmount) ?? gross
    const wht   = parseFloat(whtAmount) || 0
    const pct   = parseFloat(whtPct) || 0
    if (gross <= 0) return res.status(400).json({ error: 'Amount must be > 0' })

    const purchase = await Purchase.findOne({ id: req.params.id }).lean()
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' })

    const prevPaid   = parseFloat(purchase.paidAmount) || 0
    const total      = parseFloat(purchase.totalAmount) || 0
    const newPaid    = prevPaid + gross
    const newBalance = total - newPaid
    const newStatus  = newBalance <= 0.01 ? 'paid' : 'partial'

    const updated = await Purchase.findOneAndUpdate(
      { id: req.params.id },
      { $set: { paidAmount: newPaid, paymentStatus: newStatus } },
      { new: true }
    ).lean()

    const txDate = date || new Date().toISOString().slice(0, 10)

    // ── Ledger: debit supplier account (reduces AP by gross amount) ───────────
    if (purchase.accountHeadID) {
      await postLedgerEntry({
        accountHeadID: purchase.accountHeadID,
        contactName:   purchase.supplierName,
        date:          txDate,
        description:   `Payment to supplier for ${purchase.number}${wht > 0 ? ` (WHT ${pct}% = PKR ${wht})` : ''}`,
        documentRef:   purchase.number,
        documentType:  'payment',
        debit:         gross,
        credit:        0,
      })
    }

    // ── DayBook: net cash out of wallet ───────────────────────────────────────
    await models.dayBook.create({
      id:          Date.now().toString(),
      date:        txDate,
      type:        'expense',
      category:    'Supplier Payment',
      description: `Paid to ${purchase.supplierName || 'Supplier'} for ${purchase.number}`,
      partyName:   purchase.supplierName || '',
      accountHeadID: purchase.accountHeadID || '',
      reference:   reference || purchase.number,
      debit:       0,
      credit:      net,    // only net leaves the wallet
      wallet:      wallet || 'Cash',
      notes:       notes || '',
      companyId:   purchase.companyId || 'TAT',
    })

    // ── WHT: post to tax head as payable ──────────────────────────────────────
    if (wht > 0) {
      await models.dayBook.create({
        id:           (Date.now() + 1).toString(),
        date:         txDate,
        type:         'expense',
        category:     'WHT Payable (Tax)',
        description:  `WHT ${pct}% on ${purchase.number} — ${purchase.supplierName}`,
        partyName:    purchase.supplierName || '',
        accountHeadID: purchase.accountHeadID || '',
        taxHeadID:    'TAX-WHT',
        reference:    purchase.number,
        whtPct:       pct,
        grossAmount:  gross,
        debit:        0,
        credit:       wht,
        wallet:       'Tax Head',
        partyType:    'supplier',
        challanStatus: 'pending',
        notes:        notes || '',
        companyId:    purchase.companyId || 'TAT',
      })
    }

    res.json({ ok: true, purchase: fmtLean(updated), newPaid, newBalance: Math.max(newBalance, 0), status: newStatus })
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

      saleItems.push({ ...item, qty, costPrice, salePrice, amount, profit, marginPct,
        belowCost: salePrice < costPrice && costPrice > 0 })
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

    // ── DAY BOOK: Auto-entry ──────────────────────────────────────────────────
    await models.dayBook.create({
      id:          Date.now().toString(),
      date:        saleDate,
      type:        'income',
      category:    'Sale',
      description: `Sale: ${number} to ${req.body.clientName || 'Customer'} | Profit: PKR ${totalProfit.toLocaleString()}`,
      partyName:   req.body.clientName || '',
      reference:   number,
      debit:       total,
      credit:      0,
      wallet:      'Accounts Receivable',
      companyId:   req.body.companyId || 'TAT',
    })

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
    try {
      // Idempotency: if client sends an id and a record with that id already exists, return it (don't double-save)
      if (req.body.id) {
        const existing = await models[name].findOne({ id: req.body.id }).lean()
        if (existing) return res.json(fmtLean(existing))
      }
      // Auto-register contact from document fields
      let body = { ...req.body }
      if (name === 'quotations' && body.clientName && !body.accountHeadID) {
        body.accountHeadID = await autoRegisterContact(body.clientName, 'client', body.clientContact, body.companyId)
      }
      if (name === 'purchases' && body.supplierName && !body.accountHeadID) {
        body.accountHeadID = await autoRegisterContact(body.supplierName, 'supplier', body.supplierContact, body.companyId)
      }
      res.json(fmt(await models[name].create(body)))
    }
    catch (err) { res.status(500).json({ error: err.message }) }
  })
  app.put(`/api/${name}/:id`, async (req, res) => {
    try {
      // Try by custom id field first, then fallback to MongoDB _id
      let doc = await models[name].findOneAndUpdate({ id: req.params.id }, { $set: req.body }, { new: true }).lean()
      if (!doc) {
        const mongoose = (await import('mongoose')).default
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          doc = await models[name].findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true }).lean()
        }
      }
      if (!doc) return res.status(404).json({ error: 'Not found' })
      res.json(fmtLean(doc))
    } catch (err) { res.status(500).json({ error: err.message }) }
  })
  app.delete(`/api/${name}/:id`, async (req, res) => {
    try {
      let deleted = await models[name].findOneAndDelete({ id: req.params.id })
      if (!deleted) await models[name].findByIdAndDelete(req.params.id).catch(() => {})
      res.json({ ok: true })
    }
    catch (err) { res.status(500).json({ error: err.message }) }
  })
})

// ── Dedicated quotation status update (Approve / Reject) ──────────────────────
app.patch('/api/quotations/:id/status', async (req, res) => {
  try {
    const { status } = req.body
    if (!['draft', 'sent', 'approved', 'cancelled', 'invoiced'].includes(status))
      return res.status(400).json({ error: 'Invalid status' })

    // Try by custom id, then by _id
    let doc = await models['quotations'].findOneAndUpdate(
      { id: req.params.id },
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    ).lean()

    if (!doc) {
      const mongoose = (await import('mongoose')).default
      if (mongoose.Types.ObjectId.isValid(req.params.id)) {
        doc = await models['quotations'].findByIdAndUpdate(
          req.params.id,
          { $set: { status, updatedAt: new Date() } },
          { new: true }
        ).lean()
      }
    }
    if (!doc) return res.status(404).json({ error: 'Quotation not found' })
    res.json(fmtLean(doc))
  } catch (err) { res.status(500).json({ error: err.message }) }
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

// ─── SECURITY ENDPOINTS ───────────────────────────────────────────────────────

// Forgot password (show password for internal use)
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { username } = req.body
    if (!username) return res.status(400).json({ error: 'Username is required.' })
    const user = await User.findOne({ username }).lean()
    if (!user) return res.status(404).json({ error: 'No account found with that username.' })
    res.json({ password: user.password, name: user.name, role: user.role })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Reset password using recovery PIN or backup code
app.post('/api/reset-password', async (req, res) => {
  try {
    const { username, pin, newPassword, backupCode } = req.body
    if (!username || !newPassword) return res.status(400).json({ error: 'Username and new password required.' })
    const secDoc = await Singleton.findOne({ key: 'securitySettings' }).lean()
    const sec = secDoc?.value || {}
    const validPin = pin && String(pin) === String(sec.recoveryPin)
    const validBackup = backupCode && backupCode === sec.backupCode
    if (!validPin && !validBackup) return res.status(401).json({ error: 'Invalid recovery PIN or backup code.' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    const user = await User.findOneAndUpdate({ username }, { $set: { password: newPassword, loginAttempts: 0, lockedUntil: null } }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    await AuditLog.create({ id: Date.now().toString(), userName: username, userRole: user.role, action: 'password_reset', detail: 'Password reset via recovery PIN', ip: req.ip })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Admin change any user password
app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { username, newPassword, adminName } = req.body
    if (!username || !newPassword) return res.status(400).json({ error: 'Username and new password required.' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    const user = await User.findOneAndUpdate({ username }, { $set: { password: newPassword } }, { new: true })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    await AuditLog.create({ id: Date.now().toString(), userName: adminName || 'Admin', userRole: 'admin', action: 'password_changed', detail: `Changed password for ${username} (${user.role})`, ip: req.ip })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Toggle hide/unhide user account
app.put('/api/users/:id/hide', async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id })
    if (!user) return res.status(404).json({ error: 'User not found.' })
    user.hidden = !user.hidden
    await user.save()
    await AuditLog.create({ id: Date.now().toString(), userName: 'Admin', userRole: 'admin', action: user.hidden ? 'account_hidden' : 'account_unhidden', detail: `${user.hidden ? 'Hidden' : 'Unhidden'} account: ${user.username}`, ip: req.ip })
    res.json({ ok: true, hidden: user.hidden })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Unlock locked account
app.put('/api/users/:id/unlock', async (req, res) => {
  try {
    await User.findOneAndUpdate({ id: req.params.id }, { $set: { loginAttempts: 0, lockedUntil: null } })
    await AuditLog.create({ id: Date.now().toString(), userName: 'Admin', userRole: 'admin', action: 'account_unlocked', detail: `Unlocked account id: ${req.params.id}`, ip: req.ip })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Update employee module permissions
app.put('/api/users/:id/permissions', async (req, res) => {
  try {
    await User.findOneAndUpdate({ id: req.params.id }, { $set: { permissions: req.body.permissions } })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Security settings
app.get('/api/security-settings', async (req, res) => {
  try {
    const doc = await Singleton.findOne({ key: 'securitySettings' }).lean()
    res.json(doc?.value || { sessionTimeout: 30, maxLoginAttempts: 5, lockDuration: 15, recoveryPin: '1234', backupCode: 'TAT-2026-RESET' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.put('/api/security-settings', async (req, res) => {
  try {
    await Singleton.findOneAndUpdate({ key: 'securitySettings' }, { $set: { value: req.body } }, { upsert: true })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Audit log
app.get('/api/audit-log', async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).lean()
    res.json(logs.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})
app.post('/api/audit-log', async (req, res) => {
  try {
    await AuditLog.create({ ...req.body, id: Date.now().toString() })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SINGLETONS
// ═══════════════════════════════════════════════════════════════════════════════

app.put('/api/wallets', async (req, res) => {
  try {
    const cid = req.query.company || 'TAT'
    const doc = await Singleton.findOne({ key: 'companies' }).lean()
    const updated = (doc?.value || []).map(c => c.id === cid ? { ...c, wallets: req.body } : c)
    await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated }, { upsert: true })
    res.json(req.body)
  } catch (err) { res.status(500).json({ error: err.message }) }
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
//  COMPANIES
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/companies', async (req, res) => {
  try {
    const doc = await Singleton.findOne({ key: 'companies' }).lean()
    res.json(doc?.value || [])
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.put('/api/companies/:id', async (req, res) => {
  try {
    const doc = await Singleton.findOne({ key: 'companies' }).lean()
    const companies = doc?.value || []
    const updated = companies.map(c => c.id === req.params.id ? { ...c, ...req.body } : c)
    await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated }, { upsert: true })
    res.json(updated)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Atomically get next invoice number for a company and increment its counter
app.post('/api/companies/:id/next-invoice', async (req, res) => {
  try {
    const doc = await Singleton.findOne({ key: 'companies' }).lean()
    const companies = doc?.value || []
    const company = companies.find(c => c.id === req.params.id)
    if (!company) return res.status(404).json({ error: 'Company not found' })
    // Skip any numbers that already exist in the database (safety against duplicates)
    let num = company.invoiceCounter || 201
    while (await Invoice.exists({ number: `INV-${num}` })) { num++ }
    const updated = companies.map(c => c.id === req.params.id ? { ...c, invoiceCounter: num + 1 } : c)
    await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated }, { upsert: true })
    res.json({ number: `INV-${num}`, next: num + 1 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Atomically get next sequential number for a doc type (quotation, dn, so) per company
// Counter field: quotationCounter, dnCounter, soCounter  — starts at 1 if missing
app.post('/api/companies/:id/next-number/:type', async (req, res) => {
  try {
    const TYPE_MAP = { quotation: 'quotationCounter', dn: 'dnCounter', so: 'soCounter' }
    const PREFIX_MAP = { quotation: 'QT', dn: 'DN', so: 'SO' }
    const field  = TYPE_MAP[req.params.type]
    const prefix = PREFIX_MAP[req.params.type]
    if (!field) return res.status(400).json({ error: 'Unknown type' })
    const doc = await Singleton.findOne({ key: 'companies' }).lean()
    const companies = doc?.value || []
    const company = companies.find(c => c.id === req.params.id)
    if (!company) return res.status(404).json({ error: 'Company not found' })
    const num = company[field] || 1
    const updated = companies.map(c => c.id === req.params.id ? { ...c, [field]: num + 1 } : c)
    await Singleton.findOneAndUpdate({ key: 'companies' }, { value: updated }, { upsert: true })
    const padded = String(num).padStart(3, '0')
    res.json({ number: `${prefix}-${padded}`, next: num + 1 })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  BACKUP & RESTORE
// ═══════════════════════════════════════════════════════════════════════════════

// Full database backup — exports everything as JSON
app.get('/api/backup', async (req, res) => {
  try {
    const [contacts, ledgers, invoices, purchases, sales, stockMovements, users, auditLogs] = await Promise.all([
      Contact.find().lean(),
      Ledger.find().lean(),
      Invoice.find().lean(),
      Purchase.find().lean(),
      Sale.find().lean(),
      StockMovement.find().lean(),
      User.find().lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(1000).lean(),
    ])

    const otherData = {}
    for (const name of OTHER_COLLECTIONS) {
      otherData[name] = await models[name].find().lean()
    }

    const singletons = await Singleton.find().lean()

    const backup = {
      version: '2026.1',
      exportedAt: new Date().toISOString(),
      collections: {
        contacts, ledgers, invoices, purchases, sales, stockMovements,
        users, // full user data including passwords for complete restore
        auditLogs,
        singletons,
        ...otherData,
      }
    }

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename=tataheer-erp-backup-${new Date().toISOString().slice(0,10)}.json`)
    res.json(backup)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Restore from backup JSON
app.post('/api/restore', express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { collections, version } = req.body
    if (!collections) return res.status(400).json({ error: 'Invalid backup file' })

    const results = {}

    // Restore OTHER_COLLECTIONS (quotations, inventory, etc.)
    for (const name of OTHER_COLLECTIONS) {
      if (collections[name]?.length) {
        await models[name].deleteMany({})
        const docs = collections[name].map(({ _id, __v, ...d }) => d)
        await models[name].insertMany(docs, { ordered: false }).catch(() => {})
        results[name] = docs.length
      }
    }

    // Restore contacts
    if (collections.contacts?.length) {
      await Contact.deleteMany({})
      const docs = collections.contacts.map(({ _id, __v, ...d }) => d)
      await Contact.insertMany(docs, { ordered: false }).catch(() => {})
      results.contacts = docs.length
    }

    // Restore invoices
    if (collections.invoices?.length) {
      await Invoice.deleteMany({})
      const docs = collections.invoices.map(({ _id, __v, ...d }) => d)
      await Invoice.insertMany(docs, { ordered: false }).catch(() => {})
      results.invoices = docs.length
    }

    // Restore purchases
    if (collections.purchases?.length) {
      await Purchase.deleteMany({})
      const docs = collections.purchases.map(({ _id, __v, ...d }) => d)
      await Purchase.insertMany(docs, { ordered: false }).catch(() => {})
      results.purchases = docs.length
    }

    // Restore sales
    if (collections.sales?.length) {
      await Sale.deleteMany({})
      const docs = collections.sales.map(({ _id, __v, ...d }) => d)
      await Sale.insertMany(docs, { ordered: false }).catch(() => {})
      results.sales = docs.length
    }

    // Restore users (including passwords)
    if (collections.users?.length) {
      await User.deleteMany({})
      const docs = collections.users.map(({ _id, __v, ...d }) => d)
      await User.insertMany(docs, { ordered: false }).catch(() => {})
      results.users = docs.length
    }

    // Restore singletons (settings, wallets, etc.)
    if (collections.singletons?.length) {
      for (const s of collections.singletons) {
        const { _id, __v, ...rest } = s
        await Singleton.findOneAndUpdate({ key: rest.key }, { $set: rest }, { upsert: true })
      }
      results.singletons = collections.singletons.length
    }

    res.json({ ok: true, restored: results, message: 'Restore completed successfully!' })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  FILE ATTACHMENTS (Cloudinary)
// ═══════════════════════════════════════════════════════════════════════════════

// Upload file to Cloudinary
app.post('/api/upload', (req, res, next) => {
  if (!multerUpload) return res.status(503).json({ error: 'File upload not configured' })
  multerUpload.single('file')(req, res, next)
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' })

    const { folder = 'tat-erp', refId = '', refType = '' } = req.body

    // Images → resource_type:'image' so Cloudinary can serve/transform them.
    // Everything else (PDF, DOCX, XLSX …) → resource_type:'raw' so Cloudinary
    // stores and serves the original binary via /raw/upload/ — NOT the image
    // pipeline, which corrupts PDFs and causes "Failed to load PDF document".
    const isImage = (req.file.mimetype || '').startsWith('image/')
    const resourceType = isImage ? 'image' : 'raw'

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `tat-erp/${folder}`,
          resource_type: resourceType,
          public_id: `${refType}_${refId}_${Date.now()}`,
          use_filename: true,
        },
        (err, result) => err ? reject(err) : resolve(result)
      )
      stream.end(req.file.buffer)
    })

    // Save attachment record to DB
    await Attachment.create({
      id: Date.now().toString(),
      url: result.secure_url,
      publicId: result.public_id,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      resourceType,   // 'image' or 'raw' — needed for correct delete later
      size: req.file.size,
      refId, refType, folder,
      uploadedBy: req.body.uploadedBy || 'unknown',
    }).catch(() => null)

    res.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      originalName: req.file.originalname,
      fileType: req.file.mimetype,
      size: req.file.size,
    })
  } catch (err) {
    console.error('Upload error:', err)
    res.status(500).json({ error: err.message || 'Upload failed' })
  }
})

// Get attachments for a specific record
app.get('/api/attachments', async (req, res) => {
  try {
    const { refId, refType } = req.query
    const query = {}
    if (refId) query.refId = refId
    if (refType) query.refType = refType
    const docs = await Attachment.find(query).sort({ createdAt: -1 }).lean()
    res.json(docs.map(fmtLean))
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Delete attachment
app.delete('/api/attachments/:publicId', async (req, res) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId)
    // Look up the stored resourceType so we destroy from the right Cloudinary bucket
    const record = await Attachment.findOne({ publicId }).lean()
    const resourceType = record?.resourceType || (record?.fileType?.startsWith('image/') ? 'image' : 'raw')
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
    await Attachment.findOneAndDelete({ publicId })
    res.json({ ok: true })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// ═══════════════════════════════════════════════════════════════════════════════
//  SPA FALLBACK
// ═══════════════════════════════════════════════════════════════════════════════

if (!process.env.VERCEL) {
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'))
  })
  const PORT = process.env.PORT || 5000
  app.listen(PORT, () => console.log(`🚀 Tataheer ERP server running on port ${PORT}`))
}

export default app
