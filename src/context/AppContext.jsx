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
  purchases: [],
  sales: [],
  deliveryNotes: [],
  inventory: [],
  transactions: [],
  advances: [],
  dayBook: [],
  calendarEvents: [],
  contacts: [],
  wallets: { cash: 0, bank: 0, jazzcash: 0, easypaisa: 0 },
  settings: { invoiceCounter: 201, companyName: 'TATAHEER TRADERS' },
  securitySettings: { sessionTimeout: 30, maxLoginAttempts: 5, lockDuration: 15, recoveryPin: '1234', backupCode: 'TAT-2026-RESET' },
  companies: []
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
  const [currentCompanyId, setCurrentCompanyId] = useState(() => {
    return sessionStorage.getItem('tat_company') || 'TAT'
  })

  // Load data for the active company
  const loadData = async (companyId) => {
    try {
      const res = await fetch(`/api/data?company=${companyId || 'TAT'}`)
      const serverData = await res.json()
      setData(prev => ({ ...prev, ...serverData }))
    } catch (err) {
      console.error('Failed to load data from server:', err)
    }
  }

  // Load all data from server on mount
  useEffect(() => {
    loadData(currentCompanyId).finally(() => setLoading(false))
  }, [])

  // Persist session
  useEffect(() => {
    if (currentUser) sessionStorage.setItem('tat_user', JSON.stringify(currentUser))
    else sessionStorage.removeItem('tat_user')
  }, [currentUser])

  // Switch company — reloads all transactional data for the new company
  const switchCompany = async (companyId) => {
    setLoading(true)
    setCurrentCompanyId(companyId)
    sessionStorage.setItem('tat_company', companyId)
    await loadData(companyId)
    setLoading(false)
  }

  // Current company object
  const currentCompany = (data.companies || []).find(c => c.id === currentCompanyId) || { id: 'TAT', name: 'Tataheer Traders' }

  // ─── DATA OPERATIONS ────────────────────────────────────────────────────────

  const update = (key, value) => {
    setData(prev => {
      if (key === 'masterCode') api('PUT', '/api/master-code', { masterCode: value })
      else if (key === 'wallets') api('PUT', `/api/wallets?company=${currentCompanyId}`, value)
      else if (key === 'settings') api('PUT', '/api/settings', value)
      return { ...prev, [key]: value }
    })
  }

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

  // add a record — automatically stamps companyId
  const addRecord = (collection, record) => {
    const SHARED = ['inventory', 'calendarEvents', 'contacts']
    const newRecord = {
      ...record,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...(SHARED.includes(collection) ? {} : { companyId: currentCompanyId })
    }
    setData(prev => ({ ...prev, [collection]: [newRecord, ...prev[collection]] }))
    api('POST', `/api/${collection}`, newRecord)
    return newRecord
  }

  const updateRecord = (collection, id, updates) => {
    const withTimestamp = { ...updates, updatedAt: new Date().toISOString() }
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].map(r => r.id === id ? { ...r, ...withTimestamp } : r)
    }))
    api('PUT', `/api/${collection}/${id}`, withTimestamp)
  }

  const deleteRecord = (collection, id) => {
    setData(prev => ({ ...prev, [collection]: prev[collection].filter(r => r.id !== id) }))
    api('DELETE', `/api/${collection}/${id}`)
  }

  // Refresh all data from server
  const refreshData = async () => {
    try {
      const res = await fetch(`/api/data?company=${currentCompanyId}`)
      const serverData = await res.json()
      setData(prev => ({ ...prev, ...serverData }))
    } catch (err) {
      console.error('Failed to refresh data:', err)
    }
  }

  const verifyMasterCode = (code) => code === data.masterCode

  // Per-company invoice number (calls server to atomically increment)
  const nextInvoiceNumber = async () => {
    try {
      const res = await api('POST', `/api/companies/${currentCompanyId}/next-invoice`)
      const json = await res.json()
      // Update local counter too
      setData(prev => ({ ...prev, settings: { ...prev.settings, invoiceCounter: json.next } }))
      return json.number
    } catch (err) {
      // Fallback to local counter
      const num = data.settings.invoiceCounter
      updateNested('settings', 'invoiceCounter', num + 1)
      return `INV-${num}`
    }
  }

  // Per-company sequential number for quotations / delivery notes / supply orders
  const nextDocNumber = async (type) => {
    // type: 'quotation' | 'dn' | 'so'
    const PREFIX = { quotation: 'QT', dn: 'DN', so: 'SO' }
    try {
      const res = await api('POST', `/api/companies/${currentCompanyId}/next-number/${type}`)
      const json = await res.json()
      return json.number
    } catch {
      const padded = String(Date.now()).slice(-3)
      return `${PREFIX[type] || type.toUpperCase()}-${padded}`
    }
  }

  // ─── LOADING SCREEN ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '100vh',
        background: '#0a0a0f', color: '#e0e0e0', gap: 16
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <img
            src="/logo-tat.png"
            alt="TAT Logo"
            style={{ height: 90, objectFit: 'contain', filter: 'drop-shadow(0 0 24px rgba(209,24,24,0.5))', animation: 'pulse 2s ease-in-out infinite' }}
          />
          <img
            src="/logo-tbg.png"
            alt="Tataheer Business Group"
            style={{ height: 34, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6)) brightness(1.15)' }}
          />
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>
          Loading Tataheer ERP...
        </div>
        <div style={{
          width: 36, height: 36,
          border: '3px solid rgba(209,24,24,0.15)',
          borderTop: '3px solid #D11818',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 18px rgba(209,24,24,0.4)); }
            50% { transform: scale(1.05); filter: drop-shadow(0 0 32px rgba(209,24,24,0.7)); }
          }
        `}</style>
      </div>
    )
  }

  return (
    <AppContext.Provider value={{
      data, update, updateNested, addRecord, updateRecord, deleteRecord,
      currentUser, setCurrentUser, verifyMasterCode, nextInvoiceNumber, nextDocNumber, refreshData,
      currentCompanyId, currentCompany, switchCompany
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => useContext(AppContext)
