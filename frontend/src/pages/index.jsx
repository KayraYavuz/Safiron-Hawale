/**
 * pages/index.jsx — Re-export barrel for backward compatibility.
 * Each page now lives in its own file for code-splitting.
 * App.jsx uses React.lazy() on the individual page files directly.
 */
export { default as Dashboard }      from './Dashboard'
export { default as Transactions }   from './Transactions'
export { default as Counterparties } from './Counterparties'
export { default as Accounts }       from './Accounts'
export { default as Rates }          from './Rates'
export { default as Reports }        from './Reports'
export { default as Users }          from './Users'
export { default as Reconciliation } from './Reconciliation'
export { default as AuditLog }       from './AuditLog'
