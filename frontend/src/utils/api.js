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
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  login: (email, password) => {
    const form = new FormData()
    form.append('username', email)
    form.append('password', password)
    return api.post('/api/auth/login', form)
  },
  me: () => api.get('/api/auth/me'),
}

export const locationsApi  = { list: () => api.get('/api/locations') }
export const currenciesApi = { list: () => api.get('/api/currencies') }

export const accountsApi = {
  list:   (params) => api.get('/api/accounts', { params }),
  create: (data)   => api.post('/api/accounts', data),
  delete: (id)     => api.delete(`/api/accounts/${id}`),
}

export const counterpartiesApi = {
  list:   (params)     => api.get('/api/counterparties', { params }),
  create: (data)       => api.post('/api/counterparties', data),
  update: (id, data)   => api.put(`/api/counterparties/${id}`, data),
  delete: (id)         => api.delete(`/api/counterparties/${id}`),
}

export const ratesApi = {
  list: (params) => api.get('/api/exchange-rates', { params }),
  create: (data) => api.post('/api/exchange-rates', data),
  autoUpdate: () => api.post('/api/fx/update-rates'),
}

export const transactionsApi = {
  list: (params) => api.get('/api/transactions', { params }),
  create: (data) => api.post('/api/transactions', data),
  approve: (id) => api.patch(`/api/transactions/${id}/approve`),
  delete: (id) => api.delete(`/api/transactions/${id}`),
}

export const reportsApi = {
  position: () => api.get('/api/reports/position'),
  locationPnl: (params) => api.get('/api/reports/location-pnl', { params }),
  incomeStatement: (params) => api.get('/api/reports/income-statement', { params }),
  statement: (cpId, params) => api.get(`/api/reports/counterparty-statement/${cpId}`, { params }),
  cashMovements: (params) => api.get('/api/reports/cash-movements', { params }),
}

export const usersApi = {
  list: () => api.get('/api/users'),
  create: (data) => api.post('/api/users', data),
  resetPassword: (id, password) => api.patch(`/api/users/${id}/password`, { password }),
  delete: (id) => api.delete(`/api/users/${id}`),
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
