import { createContext, useContext, useState, useEffect } from 'react'

const AppContext = createContext()

const INITIAL_DATA = {
  masterCode: '5555',
  users: {
    admin: { username: 'admin', password: 'admin123', name: 'Administrator', role: 'admin' },
    employees: [],
    clients: []
  },
  quotations: [],
  supplyOrders: [],
  invoices: [],
  deliveryNotes: [],
  inventory: [],
  transactions: [],
  advances: [],
  dayBook: [],
  calendarEvents: [],
  contacts: [],
  wallets: { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 },
  settings: { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' }
}

// ─── API HELPER ───────────────────────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`API ${method} ${path} failed:`, err)
    }
    return res
  } catch (err) {
    console.error(`API ${method} ${path} network error:`, err)
  }
}

// Diff two user lists and sync changes to backend
async function syncUserList(type, oldList, newList) {
  const added   = newList.filter(n => !oldList.find(o => o.id === n.id))
  const removed = oldList.filter(o => !newList.find(n => n.id === o.id))
  const changed = newList.filter(n => {
    const old = oldList.find(o => o.id === n.id)
    return old && JSON.stringify(old) !== JSON.stringify(n)
  })
  for (const u of added)   await api('POST',   `/api/users/${type}`, u)
  for (const u of removed) await api('DELETE', `/api/users/${type}/${u.id}`)
  for (const u of changed) await api('PUT',    `/api/users/${type}/${u.id}`, u)
}

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export function AppProvider({ children }) {
  const [data, setData]               = useState(INITIAL_DATA)
  const [loading, setLoading]         = useState(true)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('tat_user')) } catch (_) { return null }
  })

  // Load all data from server on mount
  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(serverData => {
        setData(prev => ({ ...prev, ...serverData }))
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load data from server:', err)
        setLoading(false)
      })
  }, [])

  // Persist session
  useEffect(() => {
    if (currentUser) sessionStorage.setItem('tat_user', JSON.stringify(currentUser))
    else sessionStorage.removeItem('tat_user')
  }, [currentUser])

  // ─── DATA OPERATIONS ────────────────────────────────────────────────────────

  // update a top-level key (wallets, settings, masterCode)
  const update = (key, value) => {
    setData(prev => {
      if (key === 'masterCode') api('PUT', '/api/master-code', { masterCode: value })
      else if (key === 'wallets') api('PUT', '/api/wallets', value)
      else if (key === 'settings') api('PUT', '/api/settings', value)
      return { ...prev, [key]: value }
    })
  }

  // update a nested key
  const updateNested = (key, subKey, value) => {
    setData(prev => {
      const newNested = { ...prev[key], [subKey]: value }

      if (key === 'settings') {
        api('PUT', '/api/settings', newNested)
      } else if (key === 'users') {
        if (subKey === 'employees') {
          syncUserList('employees', prev.users.employees || [], value)
        } else if (subKey === 'clients') {
          syncUserList('clients', prev.users.clients || [], value)
        } else if (subKey === 'admin') {
          api('PUT', '/api/users/admin', value)
        }
      }

      return { ...prev, [key]: newNested }
    })
  }

  // add a record to a collection
  const addRecord = (collection, record) => {
    const newRecord = { ...record, id: Date.now().toString(), createdAt: new Date().toISOString() }
    setData(prev => ({ ...prev, [collection]: [newRecord, ...prev[collection]] }))
    api('POST', `/api/${collection}`, newRecord)
    return newRecord
  }

  // update a record in a collection
  const updateRecord = (collection, id, updates) => {
    const withTimestamp = { ...updates, updatedAt: new Date().toISOString() }
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].map(r => r.id === id ? { ...r, ...withTimestamp } : r)
    }))
    api('PUT', `/api/${collection}/${id}`, withTimestamp)
  }

  // delete a record from a collection
  const deleteRecord = (collection, id) => {
    setData(prev => ({ ...prev, [collection]: prev[collection].filter(r => r.id !== id) }))
    api('DELETE', `/api/${collection}/${id}`)
  }

  const verifyMasterCode = (code) => code === data.masterCode

  const nextInvoiceNumber = () => {
    const num = data.settings.invoiceCounter
    updateNested('settings', 'invoiceCounter', num + 1)
    return `INV-${num}`
  }

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: 'var(--bg, #0a0a0f)', color: 'var(--text, #e0e0e0)', gap: 18
      }}>
        <div style={{ fontSize: 36 }}>⚙️</div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1, textAlign: 'center' }}>
          Welcome to TATAHEER BUSINESS GROUP
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: -10 }}>Loading Tataheer ERP...</div>
        <div style={{
          width: 40, height: 40, border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #4f8ef7', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      data, update, updateNested, addRecord, updateRecord, deleteRecord,
      currentUser, setCurrentUser, verifyMasterCode, nextInvoiceNumber
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
