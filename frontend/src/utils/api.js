import axios from 'axios'
import { useAuthStore } from '../store'

const api = axios.create({ 
  baseURL: import.meta.env.VITE_API_URL || (window.location.protocol + '//' + window.location.hostname + ':8000')
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Login endpoint'inden gelen 401 normaldir (yanlış şifre) — yönlendirme yapma
    const isLoginEndpoint = err.config?.url?.includes('/auth/login') || err.config?.url?.includes('/auth/verify-otp')
    if (err.response?.status === 401 && !isLoginEndpoint) {
      useAuthStore.getState().logout()
      // Login artık Landing sayfasındaki panel üzerinden yapılıyor
      window.location.href = '/'
    }
    return Promise.reject(err)
  }
)

export default api

// ── Güvenilir cihaz token yönetimi ────────────────────────────────────────────
const DEVICE_TOKEN_KEY = 'safiron_device_token'

export const deviceToken = {
  get:    ()      => localStorage.getItem(DEVICE_TOKEN_KEY) || '',
  save:   (token) => localStorage.setItem(DEVICE_TOKEN_KEY, token),
  remove: ()      => localStorage.removeItem(DEVICE_TOKEN_KEY),
}

export const authApi = {
  login: (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    const headers = {}
    const dt = deviceToken.get()
    if (dt) headers['X-Device-Token'] = dt
    return api.post('/api/auth/login', form, { headers })
  },
  verifyOtp: (session_token, otp, trust_device = false) =>
    api.post('/api/auth/verify-otp', { session_token, otp, trust_device }),
  me: () => api.get('/api/auth/me'),
}

export const locationsApi  = {
  list:   ()         => api.get('/api/locations'),
  create: (data)     => api.post('/api/locations', data),
  update: (id, data) => api.put(`/api/locations/${id}`, data),
  delete: (id)       => api.delete(`/api/locations/${id}`),
}
export const currenciesApi = { list: () => api.get('/api/currencies') }

export const accountsApi = {
  list:   (params) => api.get('/api/accounts', { params }),
  create: (data)   => api.post('/api/accounts', data),
  delete: (id)     => api.delete(`/api/accounts/${id}`),
}

export const counterpartiesApi = {
  list:          (params)   => api.get('/api/counterparties', { params }),
  create:        (data)     => api.post('/api/counterparties', data),
  update:        (id, data) => api.put(`/api/counterparties/${id}`, data),
  delete:        (id)       => api.delete(`/api/counterparties/${id}`),
  regeneratePin: (id)       => api.post(`/api/counterparties/${id}/regenerate-pin`),
}

export const ratesApi = {
  list: (params) => api.get('/api/exchange-rates', { params }),
  create: (data) => api.post('/api/exchange-rates', data),
  autoUpdate: () => api.post('/api/fx/update-rates'),
}

export const transactionsApi = {
  list:       (params) => api.get('/api/transactions', { params }),
  create:     (data)   => api.post('/api/transactions', data),
  approve:    (id)     => api.patch(`/api/transactions/${id}/approve`),
  approveAll: ()       => api.post('/api/transactions/approve-all'),
  delete:     (id)     => api.delete(`/api/transactions/${id}`),
}

export const reportsApi = {
  position: () => api.get('/api/reports/position'),
  locationPnl: (params) => api.get('/api/reports/location-pnl', { params }),
  incomeStatement: (params) => api.get('/api/reports/income-statement', { params }),
  statement: (cpId, params) => api.get(`/api/reports/counterparty-statement/${cpId}`, { params }),
  cashMovements: (params) => api.get('/api/reports/cash-movements', { params }),
  cashflow: (params) => api.get('/api/reports/cashflow', { params }),
  aiAnalysis: (params) => api.get('/api/reports/ai-analysis', { params }),
  aiChat: (data) => api.post('/api/reports/ai-chat', data),
  listSavedReports: () => api.get('/api/reports/saved-reports'),
  createSavedReport: (data) => api.post('/api/reports/saved-reports', data),
  toggleFavoriteReport: (id) => api.patch(`/api/reports/saved-reports/${id}/favorite`),
  deleteSavedReport: (id) => api.delete(`/api/reports/saved-reports/${id}`),
}

export const usersApi = {
  list: () => api.get('/api/users'),
  create: (data) => api.post('/api/users', data),
  approve: (id) => api.patch(`/api/users/${id}/approve`),
  resetPassword: (id, password) => api.patch(`/api/users/${id}/password`, { password }),
  regeneratePin: (id) => api.post(`/api/users/${id}/regenerate-pin`),
  delete: (id) => api.delete(`/api/users/${id}`),
}

export const companiesApi = {
  list:   ()     => api.get('/api/companies'),
  create: (data) => api.post('/api/companies', data),
  toggle: (id)   => api.patch(`/api/companies/${id}/toggle`),
  updateTelegramBot: (id, token) => api.patch(`/api/companies/${id}/telegram-bot`, { token }),
}

export const supplierSettlementApi = {
  get:    (txnId) => api.get(`/api/transactions/${txnId}/supplier-settlement`),
  create: (txnId, data) => api.post(`/api/transactions/${txnId}/supplier-settlement`, data),
  delete: (txnId) => api.delete(`/api/transactions/${txnId}/supplier-settlement`),
}

export const auditApi = {
  list: (params) => api.get('/api/audit', { params }),
}

export const reconciliationApi = {
  daily: (params) => api.get('/api/reconciliation/daily', { params }),
}

export const settingsApi = {
  list:   ()            => api.get('/api/settings'),
  update: (key, value)  => api.patch(`/api/settings/${key}`, { value }),
  clear:  (key)         => api.delete(`/api/settings/${key}`),
}

export const accountingApi = {
  chart:      ()         => api.get('/api/accounting/chart'),
  initialize: (scheme)   => api.post('/api/accounting/initialize', { scheme }),
  createAcc:  (data)     => api.post('/api/accounting/chart', data),
  updateAcc:  (id, data) => api.patch(`/api/accounting/chart/${id}`, data),
  deleteAcc:  (id)       => api.delete(`/api/accounting/chart/${id}`),
  mappings:   ()         => api.get('/api/accounting/mappings'),
  setMapping: (data)     => api.put('/api/accounting/mappings', data),
  journal:          (params) => api.get('/api/accounting/journal', { params }),
  journalEntry:     (id)     => api.get(`/api/accounting/journal/${id}`),
  postableAccounts: ()       => api.get('/api/accounting/journal/postable-accounts'),
  createJournal:    (data)   => api.post('/api/accounting/journal', data),
  voidJournal:      (id)     => api.post(`/api/accounting/journal/${id}/void`),
}
