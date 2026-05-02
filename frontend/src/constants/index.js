// ── Query stale-time constants ─────────────────────────────────────────────────
export const STALE_15S  = 15_000
export const STALE_30S  = 30_000
export const STALE_2MIN = 2  * 60_000
export const STALE_5MIN = 5  * 60_000
export const STALE_10MIN = 10 * 60_000

// ── Transaction type labels / colors ──────────────────────────────────────────
export const TXN_TYPE_LABEL = {
  remittance:        'Havale',
  fx:                'Döviz (FX)',
  swift:             'SWIFT',
  deposit:           'Para Yatırma',
  withdrawal:        'Para Çekme',
  internal_transfer: 'İç Transfer',
}

export const TXN_TYPE_COLOR = {
  remittance:        { bg: 'rgba(37,99,235,0.08)',   color: '#2563EB' },
  fx:                { bg: 'rgba(107,70,193,0.10)',  color: '#6B46C1' },
  swift:             { bg: '#EEF2F7',                color: '#4A5568' },
  deposit:           { bg: 'rgba(14,164,114,0.08)',  color: '#0EA472' },
  withdrawal:        { bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
  internal_transfer: { bg: 'rgba(201,123,6,0.08)',   color: '#C97B06' },
}

// ── Status display ─────────────────────────────────────────────────────────────
export const STATUS_LABEL = {
  pending:   'Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}

// ── Counterparty type labels ──────────────────────────────────────────────────
export const CP_TYPE_LABEL = {
  customer: 'Müşteri',
  supplier: 'Tedarikçi',
  both:     'Her ikisi',
  founder:  'Ortak',
}

// ── Account type icons ────────────────────────────────────────────────────────
export const ACC_ICONS = { cash: '💵', bank: '🏦', crypto: '₿' }

// ── Role info ─────────────────────────────────────────────────────────────────
export const ROLE_INFO = {
  admin:      { label: 'Admin',         bg: 'rgba(229,62,62,0.08)',   color: '#E53E3E' },
  accounting: { label: 'Muhasebe',      bg: 'rgba(37,99,235,0.08)',   color: '#2563EB' },
  viewer:     { label: 'Görüntüleyici', bg: '#F8FAFC',                color: '#4A5568' },
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
