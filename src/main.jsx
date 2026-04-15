import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'rgba(20,20,40,0.95)',
              color: '#fff',
              border: '1px solid rgba(220,38,38,0.4)',
              backdropFilter: 'blur(20px)',
            },
          }}
        />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
)
