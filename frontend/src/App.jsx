import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { PageSpinner } from './components/Skeleton'
import { useLang } from './hooks/useLang'
import toast from 'react-hot-toast'

// ── Lazy-loaded pages — each route is its own JS chunk ────────────────────────
const Login          = lazy(() => import('./pages/Login'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Transactions   = lazy(() => import('./pages/Transactions'))
const Counterparties = lazy(() => import('./pages/Counterparties'))
const Accounts       = lazy(() => import('./pages/Accounts'))
const Rates          = lazy(() => import('./pages/Rates'))
const Reports        = lazy(() => import('./pages/Reports'))
const Reconciliation = lazy(() => import('./pages/Reconciliation'))
const AuditLog       = lazy(() => import('./pages/AuditLog'))
const AiAnalysis     = lazy(() => import('./pages/AiAnalysis'))
const Users          = lazy(() => import('./pages/Users'))

function Protected({ children }) {
  const { token, logout } = useAuthStore()
  const { t } = useLang()
  const timerRef = useRef(null)

  // 30 min inactivity auto-logout
  useEffect(() => {
    if (!token) return

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        logout()
        toast(t.sessionTimeout, { icon: '⏰' })
      }, 30 * 60 * 1000)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(name => document.addEventListener(name, resetTimer))
    
    resetTimer()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(name => document.removeEventListener(name, resetTimer))
    }
  }, [token, logout, t])

  if (!token) return <Navigate to="/login" replace />
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageSpinner />}>
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
          <Route path="/analysis"       element={<Protected><AiAnalysis /></Protected>} />
          <Route path="/users"          element={<Protected><Users /></Protected>} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
