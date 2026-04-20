import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      gutter={8}
      containerStyle={{ zIndex: 9999 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1a1e29',
          color: '#f1f5f9',
          border: '1px solid #2e3446',
          fontFamily: '"DM Sans", sans-serif',
          fontSize: '14px',
          borderRadius: '10px',
          padding: '12px 16px',
        },
        success: {
          iconTheme: { primary: '#22c55e', secondary: '#1a1e29' },
          duration: 3000,
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#1a1e29' },
          duration: 5000,
        },
      }}
    />
  </React.StrictMode>
)
