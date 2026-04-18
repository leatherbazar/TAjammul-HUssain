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

// ─── SCHEMAS & MODELS ─────────────────────────────────────────────────────────

// Generic flexible schema for all business records
const flexSchema = () => new mongoose.Schema({}, { strict: false, timestamps: true })

const COLLECTIONS = [
  'quotations', 'supplyOrders', 'invoices', 'deliveryNotes',
  'inventory', 'transactions', 'advances', 'dayBook',
  'calendarEvents', 'contacts'
]

const models = {}
COLLECTIONS.forEach(name => {
  models[name] = mongoose.model(name, flexSchema())
})

// User model
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

// Singleton model (wallets, settings, masterCode)
const Singleton = mongoose.model('Singleton', new mongoose.Schema({
  key:   { type: String, unique: true },
  value: mongoose.Schema.Types.Mixed
}))

// ─── INITIALIZE DEFAULTS ──────────────────────────────────────────────────────
mongoose.connection.once('open', async () => {
  try {
    await Singleton.findOneAndUpdate(
      { key: 'wallets' },
      { $setOnInsert: { value: { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 } } },
      { upsert: true }
    )
    await Singleton.findOneAndUpdate(
      { key: 'settings' },
      { $setOnInsert: { value: { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' } } },
      { upsert: true }
    )
    await Singleton.findOneAndUpdate(
      { key: 'masterCode' },
      { $setOnInsert: { value: '5555' } },
      { upsert: true }
    )
    const adminExists = await User.findOne({ role: 'admin' })
    if (!adminExists) {
      await User.create({
        id: 'admin',
        username: process.env.ADMIN_USER || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        name: 'Administrator',
        role: 'admin'
      })
    }
    console.log('✅ Database defaults initialized')
  } catch (err) {
    console.error('Init error:', err)
  }
})

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(doc) {
  const obj = doc && doc.toObject ? doc.toObject() : { ...doc }
  const { _id, __v, ...rest } = obj
  return { ...rest, id: rest.id || (_id ? _id.toString() : undefined) }
}

function fmtLean(d) {
  const { _id, __v, ...rest } = d
  return { ...rest, id: rest.id || (_id ? _id.toString() : undefined) }
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body
    const user = await User.findOne({ username, password })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })
    if (user.role === 'employee' && user.active === false) {
      return res.status(401).json({ error: 'Account disabled. Contact admin.' })
    }
    res.json(fmt(user))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password, company, phone } = req.body
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'Name, username and password are required.' })
    }
    const existing = await User.findOne({ username })
    if (existing) return res.status(400).json({ error: 'Username already taken.' })
    const id = Date.now().toString()
    const user = await User.create({ id, name, username, password, company, phone, role: 'client' })
    res.json(fmt(user))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── LOAD ALL DATA (initial page load) ───────────────────────────────────────

app.get('/api/data', async (req, res) => {
  try {
    const result = {}

    // All collections
    for (const name of COLLECTIONS) {
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
      admin: {
        username: admin?.username || process.env.ADMIN_USER || 'admin',
        password: admin?.password || process.env.ADMIN_PASSWORD || 'admin123',
        name: admin?.name || 'Administrator',
        role: 'admin'
      },
      employees: employees.map(fmtLean),
      clients:   clients.map(fmtLean)
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
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── GENERIC COLLECTION CRUD ──────────────────────────────────────────────────

COLLECTIONS.forEach(name => {
  // Create
  app.post(`/api/${name}`, async (req, res) => {
    try {
      const doc = await models[name].create(req.body)
      res.json(fmt(doc))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Update (lookup by custom id field)
  app.put(`/api/${name}/:id`, async (req, res) => {
    try {
      const doc = await models[name].findOneAndUpdate(
        { id: req.params.id },
        { $set: req.body },
        { new: true }
      ).lean()
      if (!doc) return res.status(404).json({ error: 'Record not found' })
      res.json(fmtLean(doc))
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  // Delete
  app.delete(`/api/${name}/:id`, async (req, res) => {
    try {
      await models[name].findOneAndDelete({ id: req.params.id })
      res.json({ ok: true })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })
})

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

// Add employee
app.post('/api/users/employees', async (req, res) => {
  try {
    const existing = await User.findOne({ username: req.body.username })
    if (existing) return res.status(400).json({ error: 'Username already taken.' })
    const user = await User.create({ ...req.body, role: 'employee' })
    res.json(fmt(user))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update employee (toggle active, etc.)
app.put('/api/users/employees/:id', async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { id: req.params.id, role: 'employee' },
      { $set: req.body },
      { new: true }
    )
    if (!user) return res.status(404).json({ error: 'Employee not found' })
    res.json(fmt(user))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete employee
app.delete('/api/users/employees/:id', async (req, res) => {
  try {
    await User.findOneAndDelete({ id: req.params.id, role: 'employee' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete client
app.delete('/api/users/clients/:id', async (req, res) => {
  try {
    await User.findOneAndDelete({ id: req.params.id, role: 'client' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update admin (password change)
app.put('/api/users/admin', async (req, res) => {
  try {
    await User.findOneAndUpdate({ role: 'admin' }, { $set: req.body })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── SINGLETONS ───────────────────────────────────────────────────────────────

app.put('/api/wallets', async (req, res) => {
  try {
    await Singleton.findOneAndUpdate({ key: 'wallets' }, { value: req.body }, { upsert: true })
    res.json(req.body)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/settings', async (req, res) => {
  try {
    await Singleton.findOneAndUpdate({ key: 'settings' }, { value: req.body }, { upsert: true })
    res.json(req.body)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.put('/api/master-code', async (req, res) => {
  try {
    await Singleton.findOneAndUpdate(
      { key: 'masterCode' },
      { value: req.body.masterCode },
      { upsert: true }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`🚀 Tataheer ERP server running on port ${PORT}`))
