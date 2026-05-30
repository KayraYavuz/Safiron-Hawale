import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { HelmetProvider } from 'react-helmet-async'
import App from './App'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Master data (currencies, accounts) → 5 min; mutations invalidate immediately
      staleTime:           30_000,
      // Network errors: don't refetch on window focus — avoids flash of loading states
      refetchOnWindowFocus: false,
      // Keep stale data in cache for 10 minutes after last use
      gcTime:              10 * 60_000,
    },
    mutations: {
      // Don't retry mutations (network idempotency unknown)
      retry: 0,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: { fontFamily: 'var(--font)', fontSize: 13.5 },
            }}
          />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </React.StrictMode>
)
