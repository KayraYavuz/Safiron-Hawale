import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { PageSpinner } from './components/Skeleton'

// ── Lazy-loaded pages — each route is its own JS chunk ────────────────────────
// Vite splits these into separate bundles; only the active route's JS is loaded.
const Login          = lazy(() => import('./pages/Login'))
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Transactions   = lazy(() => import('./pages/Transactions'))
const Counterparties = lazy(() => import('./pages/Counterparties'))
const Accounts       = lazy(() => import('./pages/Accounts'))
const Rates          = lazy(() => import('./pages/Rates'))
const Reports        = lazy(() => import('./pages/Reports'))
const Reconciliation = lazy(() => import('./pages/Reconciliation'))
const AuditLog       = lazy(() => import('./pages/AuditLog'))
const Users          = lazy(() => import('./pages/Users'))

function Protected({ children }) {
  const { token } = useAuthStore()
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
          <Route path="/users"          element={<Protected><Users /></Protected>} />
          <Route path="*"               element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
