import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/Layout'
import Login from './pages/Login'
import { Dashboard, Transactions, Counterparties, Accounts, Rates, Reports, Users, Reconciliation, AuditLog } from './pages/index'
import toast from 'react-hot-toast'

function Protected({ children }) {
  const { token, logout } = useAuthStore()
  const timerRef = useRef(null)

  // 30 Dakika Atalet Kontrolü (Auto Logout)
  useEffect(() => {
    if (!token) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logout()
        toast('Oturum zaman aşımı nedeniyle kapatıldı.', { icon: '⏰' })
      }, 30 * 60 * 1000) // 30 dakika
    }

    // Kullanıcı hareketlerini dinle
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(name => document.addEventListener(name, resetTimer))
    
    resetTimer() // İlk açılışta başlat

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(name => document.removeEventListener(name, resetTimer))
    }
  }, [token, logout])

  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"          element={<Login />} />
      <Route path="/"               element={<Protected><Dashboard /></Protected>} />
      <Route path="/transactions"   element={<Protected><Transactions /></Protected>} />
      <Route path="/counterparties" element={<Protected><Counterparties /></Protected>} />
      <Route path="/accounts"       element={<Protected><Accounts /></Protected>} />
      <Route path="/rates"          element={<Protected><Rates /></Protected>} />
      <Route path="/reports"        element={<Protected><Reports /></Protected>} />
      <Route path="/reconciliation" element={<Protected><Reconciliation /></Protected>} />
      <Route path="/audit"          element={<Protected><AuditLog /></Protected>} />
      <Route path="/users"          element={<Protected><Users /></Protected>} />
      <Route path="*"               element={<Navigate to="/" replace />} />
    </Routes>
  )
}
