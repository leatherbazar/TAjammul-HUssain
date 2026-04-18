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
  documentType:  { type: String, enum: ['invoice', 'quotation', 'daybook', 'advance', 'payment', 'manual'] },
  debit:         { type: Number, default: 0 }, // client owes us / we owe supplier
  credit:        { type: Number, default: 0 }, // payment received / we paid supplier
  balance:       { type: Number, default: 0 }, // running balance after this entry
}, { timestamps: true })

const Ledger = mongoose.model('Ledger', LedgerSchema)

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

// ── Supply Order — with ledger trigger (supplier debit when order placed) ──────
app.post('/api/supplyOrders', async (req, res) => {
  try {
    const doc = await models.supplyOrders.create(req.body)
    if (req.body.accountHeadID) {
      const totalAmount = (req.body.items || []).reduce((s, i) =>
        s + (parseInt(i.qty) || 0) * (parseFloat(i.marketPrice) || 0), 0)
      if (totalAmount > 0) {
        await postLedgerEntry({
          accountHeadID: req.body.accountHeadID,
          contactName:   req.body.supplierName,
          date:          req.body.date,
          description:   `Supply Order: ${req.body.title || req.body.number || ''}`,
          documentRef:   req.body.number || doc.id,
          documentType:  'manual',
          debit:         totalAmount, // we ordered, supplier to deliver
          credit:        0,
        })
      }
    }
    res.json(fmt(doc))
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
