import React, { createContext, useContext, useState, useEffect } from 'react'

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

function loadData() {
  try {
    const stored = localStorage.getItem('tataheer_erp_v1')
    if (stored) return JSON.parse(stored)
  } catch (_) {}
  return INITIAL_DATA
}

export function AppProvider({ children }) {
  const [data, setData] = useState(loadData)
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('tat_user')) } catch (_) { return null }
  })

  useEffect(() => {
    localStorage.setItem('tataheer_erp_v1', JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (currentUser) sessionStorage.setItem('tat_user', JSON.stringify(currentUser))
    else sessionStorage.removeItem('tat_user')
  }, [currentUser])

  const update = (key, value) => setData(prev => ({ ...prev, [key]: value }))

  const updateNested = (key, subKey, value) =>
    setData(prev => ({ ...prev, [key]: { ...prev[key], [subKey]: value } }))

  const addRecord = (collection, record) => {
    const newRecord = { ...record, id: Date.now().toString(), createdAt: new Date().toISOString() }
    setData(prev => ({ ...prev, [collection]: [newRecord, ...prev[collection]] }))
    return newRecord
  }

  const updateRecord = (collection, id, updates) =>
    setData(prev => ({
      ...prev,
      [collection]: prev[collection].map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r)
    }))

  const deleteRecord = (collection, id) =>
    setData(prev => ({ ...prev, [collection]: prev[collection].filter(r => r.id !== id) }))

  const verifyMasterCode = (code) => code === data.masterCode

  const nextInvoiceNumber = () => {
    const num = data.settings.invoiceCounter
    updateNested('settings', 'invoiceCounter', num + 1)
    return `INV-${num}`
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
