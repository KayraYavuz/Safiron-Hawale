/**
 * Page configuration for SEO and auth requirements
 */

export const pageConfig = {
  dashboard: { noIndex: true, requiresAuth: true },
  admin: { noIndex: true, requiresAuth: true },
  settings: { noIndex: true, requiresAuth: true },
  integrations: { noIndex: true, requiresAuth: true },
  auditlog: { noIndex: true, requiresAuth: true },
  users: { noIndex: true, requiresAuth: true },
  companies: { noIndex: true, requiresAuth: true },
  accounts: { noIndex: true, requiresAuth: true },
  transactions: { noIndex: true, requiresAuth: true },
  counterparties: { noIndex: true, requiresAuth: true },
  reports: { noIndex: true, requiresAuth: true },
  rates: { noIndex: true, requiresAuth: true },
  cashflow: { noIndex: true, requiresAuth: true },
  reconciliation: { noIndex: true, requiresAuth: true },
  aiwanalysis: { noIndex: true, requiresAuth: true },
  login: { noIndex: false, requiresAuth: false },
  landing: { noIndex: false, requiresAuth: false },
  gizlilikpolitikasi: { noIndex: false, requiresAuth: false },
  kullanimsartlari: { noIndex: false, requiresAuth: false },
};

export function getPageConfig(pageName) {
  return pageConfig[pageName] || { noIndex: false, requiresAuth: false };
}
