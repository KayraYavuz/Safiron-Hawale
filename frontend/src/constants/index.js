// ── Query stale-time constants ─────────────────────────────────────────────────
export const STALE_15S  = 15_000
export const STALE_30S  = 30_000
export const STALE_2MIN = 2  * 60_000
export const STALE_5MIN = 5  * 60_000
export const STALE_10MIN = 10 * 60_000

// ── Transaction type labels / colors (language-aware) ─────────────────────────
export function getTxnTypeLabel(t) {
  return {
    remittance:        t.remittance,
    fx:                t.fx,
    swift:             t.swift,
    deposit:           t.deposit,
    withdrawal:        t.withdrawal,
    internal_transfer: t.internalTransfer,
  }
}

export const TXN_TYPE_COLOR = {
  remittance:        { bg: 'rgba(37,99,235,0.08)',   color: '#2563EB' },
  fx:                { bg: 'rgba(107,70,193,0.10)',  color: '#6B46C1' },
  swift:             { bg: '#EEF2F7',                color: '#4A5568' },
  deposit:           { bg: 'rgba(14,164,114,0.08)',  color: '#0EA472' },
  withdrawal:        { bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
  internal_transfer: { bg: 'rgba(201,123,6,0.08)',   color: '#C97B06' },
}

// ── Status display (language-aware) ────────────────────────────────────────────
export const STATUS_LABEL = {
  pending:   'Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
}

export function getStatusLabel(t) {
  return {
    pending:   t.pending,
    completed: t.completed,
    cancelled: t.cancelled,
  }
}

// ── Counterparty type labels (language-aware) ─────────────────────────────────
export function getCpTypeLabel(t) {
  return {
    customer: t.customer,
    supplier: t.supplier,
    both:     t.both,
    founder:  t.founder,
  }
}

// ── Account type icons ────────────────────────────────────────────────────────
export const ACC_ICONS = { cash: '💵', bank: '🏦', crypto: '₿' }

// ── Role info (language-aware) ────────────────────────────────────────────────
export function getRoleInfo(t) {
  return {
    admin:      { label: t.roleAdmin,      bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
    accounting: { label: t.roleAccounting, bg: 'rgba(37,99,235,0.08)',   color: '#2563EB' },
    viewer:     { label: t.roleViewer,     bg: '#F8FAFC',                color: '#4A5568' },
  }
}

// ── Audit action colors ───────────────────────────────────────────────────────
export const AUDIT_ACTION_COLOR = {
  LOGIN:      { bg: 'rgba(14,164,114,0.08)',  color: '#0EA472' },
  LOGIN_FAIL: { bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
  CREATE:     { bg: 'rgba(37,99,235,0.08)',   color: '#2563EB' },
  DELETE:     { bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
  UPDATE:     { bg: 'rgba(201,123,6,0.08)',   color: '#C97B06' },
  APPROVE:    { bg: 'rgba(14,164,114,0.08)',  color: '#0EA472' },
}
