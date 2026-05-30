import { lazy, Suspense, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { PageSpinner } from './components/Skeleton'
import { useLang } from './hooks/useLang'
import toast from 'react-hot-toast'
import CookieConsent from './components/CookieConsent'
import StructuredData, { organizationSchema, softwareApplicationSchema } from './components/StructuredData'

// ── Lazy-loaded pages — each route is its own JS chunk ────────────────────────
const Landing        = lazy(() => import('./pages/Landing'))
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
const CashFlow       = lazy(() => import('./pages/CashFlow'))
const Users          = lazy(() => import('./pages/Users'))
const Companies           = lazy(() => import('./pages/Companies'))
const Integrations        = lazy(() => import('./pages/Integrations'))
const GizlilikPolitikasi  = lazy(() => import('./pages/GizlilikPolitikasi'))
const KullanimSartlari    = lazy(() => import('./pages/KullanimSartlari'))

// Giriş yapmamış kullanıcılar için — giriş yapılmışsa dashboard'a yönlendir
function PublicOnly({ children }) {
  const { token } = useAuthStore()
  const { user }  = useAuthStore()
  if (token) {
    return <Navigate to={user?.role === 'super_admin' ? '/companies' : '/dashboard'} replace />
  }
  return children
}

function Protected({ children }) {
  const { token, logout } = useAuthStore()
  const { user }    = useAuthStore()
  const { t } = useLang()
  const timerRef = useRef(null)
  const location = useLocation()

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

  if (!token) return <Navigate to="/" replace />
  // Super admin goes to company management, not dashboard
  if (user?.role === 'super_admin' && location.pathname === '/dashboard') {
    return <Navigate to="/companies" replace />
  }
  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <ErrorBoundary>
      <StructuredData schema={organizationSchema} />
      <StructuredData schema={softwareApplicationSchema} />
      <CookieConsent />
      <Suspense fallback={<PageSpinner />}>
        <Routes>
          {/* Genel (halka açık) sayfalar */}
          <Route path="/"               element={<PublicOnly><Landing /></PublicOnly>} />
          <Route path="/login"          element={<PublicOnly><Login /></PublicOnly>} />

          {/* Korumalı sayfalar */}
          <Route path="/dashboard"      element={<Protected><Dashboard /></Protected>} />
          <Route path="/transactions"   element={<Protected><Transactions /></Protected>} />
          <Route path="/counterparties" element={<Protected><Counterparties /></Protected>} />
          <Route path="/accounts"       element={<Protected><Accounts /></Protected>} />
          <Route path="/rates"          element={<Protected><Rates /></Protected>} />
          <Route path="/reports"        element={<Protected><Reports /></Protected>} />
          <Route path="/reconciliation" element={<Protected><Reconciliation /></Protected>} />
          <Route path="/audit"          element={<Protected><AuditLog /></Protected>} />
          <Route path="/analysis"       element={<Protected><AiAnalysis /></Protected>} />
          <Route path="/cashflow"       element={<Protected><CashFlow /></Protected>} />
          <Route path="/users"          element={<Protected><Users /></Protected>} />
          <Route path="/companies"      element={<Protected><Companies /></Protected>} />
          <Route path="/integrations"   element={<Protected><Integrations /></Protected>} />
          {/* Yasal sayfalar — herkese açık */}
          <Route path="/gizlilik-politikasi" element={<GizlilikPolitikasi />} />
          <Route path="/kullanim-sartlari"   element={<KullanimSartlari />} />

          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
