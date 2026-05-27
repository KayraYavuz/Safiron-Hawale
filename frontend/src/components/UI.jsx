import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addCommas, stripCommas } from '../utils/format'
import { useLang } from '../hooks/useLang'

// ── Design Tokens ─────────────────────────────────────────────────────────────
export const C = {
  navy:     '#0D1B2E',
  navy2:    '#111F33',
  navy3:    '#1A2E48',
  accent:   '#C9A84C',
  bg:       '#F2F5F9',
  surface:  '#FFFFFF',
  surface2: '#F8FAFC',
  surface3: '#EEF2F7',
  border:   '#E5EAF0',
  border2:  '#D2DAE6',
  text1:    '#0D1B2E',
  text2:    '#4A5568',
  text3:    '#8898AA',
  text4:    '#B4BFCD',
  green:    '#0EA472',
  greenBg:  'rgba(14,164,114,0.08)',
  red:      '#E53E3E',
  redBg:    'rgba(229,62,62,0.08)',
  amber:    '#C97B06',
  amberBg:  'rgba(201,123,6,0.08)',
  blue:     '#2563EB',
  blueBg:   'rgba(37,99,235,0.08)',
  purple:   '#6B46C1',
  purpleBg: 'rgba(107,70,193,0.08)',
  shSm:     '0 1px 3px rgba(13,27,46,0.05), 0 1px 2px rgba(13,27,46,0.03)',
  shMd:     '0 4px 12px rgba(13,27,46,0.07), 0 1px 3px rgba(13,27,46,0.04)',
  shLg:     '0 8px 24px rgba(13,27,46,0.10), 0 2px 6px rgba(13,27,46,0.05)',
  shXl:     '0 20px 48px rgba(13,27,46,0.15), 0 6px 14px rgba(13,27,46,0.07)',
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
// Animates from 0 → target using easeOutExpo over `duration` ms
function useCountUp(target, duration = 850) {
  const [count, setCount] = useState(0)
  const rafRef   = useRef(null)
  const prevRef  = useRef(null)

  useEffect(() => {
    if (prevRef.current === target) return
    prevRef.current = target

    const startTime = performance.now()
    const from = 0

    const tick = (now) => {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased    = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCount(Math.round(from + (target - from) * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }

    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return count
}

// ── Animated dollar value ─────────────────────────────────────────────────────
// Parses "$1,234" → animates from 0 → 1234 → displays back as "$1,234"
function AnimatedDollar({ raw }) {
  const target = useMemo(() => {
    const n = parseInt(raw.replace(/,/g, ''), 10)
    return isFinite(n) ? n : 0
  }, [raw])

  const count = useCountUp(target)
  return <>${count.toLocaleString()}</>
}

// ── Button ────────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', onClick, disabled, style = {}, size = 'md' }) {
  const variants = {
    primary: { bg: C.navy,    color: 'white',  border: 'none',                              shadow: C.shSm },
    accent:  { bg: C.accent,  color: C.navy,   border: 'none',                              shadow: C.shSm },
    ghost:   { bg: 'white',   color: C.text2,  border: `1px solid ${C.border}`,             shadow: 'none' },
    danger:  { bg: C.redBg,   color: C.red,    border: `1px solid rgba(229,62,62,0.2)`,     shadow: 'none' },
    success: { bg: C.green,   color: 'white',  border: 'none',                              shadow: C.shSm },
    subtle:  { bg: C.surface3,color: C.text2,  border: `1px solid ${C.border}`,             shadow: 'none' },
  }
  const v   = variants[variant] || variants.primary
  const pad = { sm: '5px 11px', md: '8px 15px', lg: '11px 20px' }[size] || '8px 15px'
  const fs  = { sm: 12, md: 13, lg: 14 }[size] || 13

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-press${variant === 'primary' ? ' btn-primary-hover' : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: pad, borderRadius: 7,
        fontSize: fs, fontWeight: 500, fontFamily: 'var(--font)',
        cursor:  disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        background: v.bg, color: v.color,
        border: v.border,
        boxShadow: v.shadow,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// ── Input ─────────────────────────────────────────────────────────────────────
export function Input({ label, hint, error, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: C.text2, letterSpacing: '-0.005em' }}>
          {label}
          {hint && <span style={{ color: C.text4, fontWeight: 400, marginLeft: 4 }}>{hint}</span>}
        </label>
      )}
      <input
        style={{
          width: '100%', padding: '8px 11px',
          border: `1px solid ${error ? C.red : C.border}`,
          borderRadius: 7, fontSize: 13.5,
          color: C.text1, background: 'white',
          fontFamily: 'var(--font)', outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        onFocus={e => {
          e.target.style.borderColor = C.navy3
          e.target.style.boxShadow   = '0 0 0 3px rgba(13,27,46,0.10)'
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? C.red : C.border
          e.target.style.boxShadow   = 'none'
        }}
        {...props}
      />
      {error && <span style={{ fontSize: 11.5, color: C.red }}>{error}</span>}
    </div>
  )
}

// ── Select ────────────────────────────────────────────────────────────────────
export function Select({ label, hint, children, style = {}, ...props }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: C.text2, letterSpacing: '-0.005em' }}>
          {label}
          {hint && <span style={{ color: C.text4, fontWeight: 400, marginLeft: 4 }}>{hint}</span>}
        </label>
      )}
      <select
        style={{
          width: '100%', padding: '8px 11px',
          border: `1px solid ${C.border}`,
          borderRadius: 7, fontSize: 13.5,
          color: C.text1, background: 'white',
          fontFamily: 'var(--font)', outline: 'none',
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        onFocus={e => {
          e.target.style.borderColor = C.navy3
          e.target.style.boxShadow   = '0 0 0 3px rgba(13,27,46,0.10)'
        }}
        onBlur={e => {
          e.target.style.borderColor = C.border
          e.target.style.boxShadow   = 'none'
        }}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

// ── AmountInput ───────────────────────────────────────────────────────────────
export function AmountInput({ label, hint, value, onChange, onCalc, currency, highlight, style = {} }) {
  const handleChange = useCallback((e) => {
    const raw   = e.target.value.replace(/[^0-9.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) return
    onChange(addCommas(parts[0]) + (parts[1] !== undefined ? '.' + parts[1] : ''))
  }, [onChange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 500, color: C.text2, letterSpacing: '-0.005em' }}>
          {label}
          {currency && (
            <span style={{ color: C.navy3, fontWeight: 600, marginLeft: 6, fontSize: 11.5, letterSpacing: '0.02em' }}>
              {currency}
            </span>
          )}
          {hint && <span style={{ color: C.text4, fontWeight: 400, marginLeft: 4 }}>{hint}</span>}
        </label>
      )}
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        style={{
          width: '100%', padding: '9px 12px',
          border: `1px solid ${highlight ? C.green : C.border}`,
          borderRadius: 7, fontSize: 15,
          fontFamily: 'var(--mono)', color: C.text1,
          background: highlight ? 'rgba(14,164,114,0.03)' : 'white',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          letterSpacing: '-0.01em',
          ...style,
        }}
        onFocus={e => {
          e.target.style.borderColor = highlight ? C.green : C.navy3
          e.target.style.boxShadow   = highlight
            ? '0 0 0 3px rgba(14,164,114,0.12)'
            : '0 0 0 3px rgba(13,27,46,0.10)'
        }}
        onBlur={e => {
          e.target.style.borderColor = highlight ? C.green : C.border
          e.target.style.boxShadow   = 'none'
          if (onCalc) onCalc()
        }}
      />
    </div>
  )
}

// ── RateInput ─────────────────────────────────────────────────────────────────
export function RateInput({ label, hint, value, onChange, accent = 'amber', style = {} }) {
  const th = {
    amber: { border: 'rgba(201,123,6,0.22)',  bg: 'rgba(201,123,6,0.04)',  text: C.amber  },
    red:   { border: 'rgba(229,62,62,0.22)',  bg: 'rgba(229,62,62,0.04)',  text: C.red    },
    green: { border: 'rgba(14,164,114,0.22)', bg: 'rgba(14,164,114,0.04)', text: C.green  },
  }[accent] || {}

  return (
    <div style={{ border: `1px solid ${th.border}`, borderRadius: 9, padding: '11px 12px', background: th.bg }}>
      {label && (
        <div style={{ fontSize: 12, fontWeight: 600, color: th.text, marginBottom: 7, letterSpacing: '-0.005em' }}>
          {label}
        </div>
      )}
      <input
        type="text" inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value.replace(',', '.'))}
        placeholder="0.0000"
        style={{
          width: '100%', padding: '8px 10px', borderRadius: 6,
          border: `1px solid ${th.border}`, background: 'white',
          fontSize: 14.5, fontFamily: 'var(--mono)', color: C.text1,
          outline: 'none', letterSpacing: '-0.01em',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        onFocus={e => {
          e.target.style.borderColor = th.text
          e.target.style.boxShadow   = `0 0 0 3px ${th.bg}`
        }}
        onBlur={e => {
          e.target.style.borderColor = th.border
          e.target.style.boxShadow   = 'none'
        }}
      />
      {hint && <div style={{ fontSize: 11.5, color: th.text, marginTop: 5, opacity: 0.8 }}>{hint}</div>}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────
export function Card({ children, style = {}, lift = false }) {
  return (
    <div
      className={lift ? 'card-lift' : ''}
      style={{
        background: 'white',
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, action }) {
  return (
    <div style={{
      padding: '13px 18px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{
        fontWeight: 600, fontSize: 13,
        color: C.text1, letterSpacing: '-0.01em',
      }}>
        {children}
      </span>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────
export function Table({ children }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        {children}
      </table>
    </div>
  )
}

export function Th({ children, right, style = {} }) {
  return (
    <th style={{
      padding: '9px 16px',
      textAlign: right ? 'right' : 'left',
      fontSize: 11, fontWeight: 600,
      color: C.text3,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      background: C.surface2,
      borderBottom: `1px solid ${C.border}`,
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  )
}

export function Td({ children, right, mono, style = {} }) {
  return (
    <td style={{
      padding: '11px 16px',
      textAlign: right ? 'right' : 'left',
      fontSize: 13.5,
      borderBottom: `1px solid ${C.border}`,
      color: C.text1,
      fontFamily: mono ? 'var(--mono)' : 'var(--font)',
      verticalAlign: 'middle',
      ...style,
    }}>
      {children}
    </td>
  )
}

export function TrHover({ children, onClick, style = {} }) {
  return (
    <tr
      onClick={onClick}
      style={{ transition: 'background 0.12s', cursor: onClick ? 'pointer' : 'default', ...style }}
      onMouseEnter={e => e.currentTarget.style.background = C.surface2}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </tr>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const BADGES = {
  pending:    { bg: C.amberBg,  color: C.amber,  dot: C.amber  },
  completed:  { bg: C.greenBg,  color: C.green,  dot: C.green  },
  cancelled:  { bg: C.redBg,    color: C.red,    dot: C.red    },
  customer:   { bg: C.blueBg,   color: C.blue,   dot: C.blue   },
  supplier:   { bg: C.amberBg,  color: C.amber,  dot: C.amber  },
  founder:    { bg: C.purpleBg, color: C.purple, dot: C.purple },
  both:       { bg: C.greenBg,  color: C.green,  dot: C.green  },
  auto:       { bg: C.greenBg,  color: C.green,  dot: C.green  },
  manual:     { bg: C.surface3, color: C.text3,  dot: C.text4  },
  admin:      { bg: C.redBg,    color: C.red,    dot: C.red    },
  accounting: { bg: C.blueBg,   color: C.blue,   dot: C.blue   },
  viewer:     { bg: C.surface3, color: C.text3,  dot: C.text4  },
}

export function Badge({ type, children, dot = false }) {
  const th = BADGES[type] || { bg: C.surface3, color: C.text2, dot: C.text3 }
  // Pending badge gets a pulsing dot
  const isPending = type === 'pending'

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2px 8px', borderRadius: 99,
      fontSize: 11.5, fontWeight: 500,
      background: th.bg, color: th.color,
      letterSpacing: '0.01em', whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span
          className={isPending ? 'dot-pulse' : ''}
          style={{ width: 5, height: 5, borderRadius: '50%', background: th.dot, flexShrink: 0 }}
        />
      )}
      {children}
    </span>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function Modal({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose?.()}
      role="dialog" aria-modal="true" aria-label={title}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(13,27,46,0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 20,
        animation: 'fadeIn 0.2s ease both',
      }}
    >
      <div
        className="fade-up"
        style={{
          background: 'white', borderRadius: 12,
          width: '100%', maxWidth: 520, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: C.shXl,
          border: `1px solid ${C.border}`,
        }}
      >
        {/* Header */}
        <div style={{
          padding: '15px 20px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14.5, color: C.text1, letterSpacing: '-0.01em' }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="icon-btn"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.text4, padding: 5, borderRadius: 6,
              display: 'flex', alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '13px 20px', borderTop: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            background: C.surface2, borderRadius: '0 0 12px 12px',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Steps ─────────────────────────────────────────────────────────────────────
export function Steps({ current, total }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          borderRadius: 99, transition: 'all 0.25s ease',
          width: i + 1 === current ? 20 : 5,
          height: 5,
          background: i + 1 === current ? C.accent : i + 1 < current ? C.navy3 : C.border2,
        }} />
      ))}
    </div>
  )
}

// ── SumRow ────────────────────────────────────────────────────────────────────
export function SumRow({ label, value, highlight, warn, sub }) {
  if (!value && value !== 0) return null
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: highlight ? '9px 0 3px' : '6px 0',
      borderTop: highlight ? `1px solid ${C.border}` : 'none',
      marginTop: highlight ? 6 : 0,
    }}>
      <div>
        <span style={{
          fontSize: 13, fontWeight: highlight ? 600 : 400,
          color: highlight ? C.text1 : warn ? C.amber : C.text2,
        }}>
          {label}
        </span>
        {sub && <div style={{ fontSize: 11, color: C.text4, marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{
        fontFamily: 'var(--mono)', fontSize: 13.5,
        fontWeight: highlight ? 700 : 500,
        color: highlight ? C.green : warn ? C.amber : C.text1,
        letterSpacing: '-0.01em',
      }}>
        {value}
      </span>
    </div>
  )
}

// ── Info ──────────────────────────────────────────────────────────────────────
export function Info({ children, type = 'info' }) {
  const th = {
    info:    { bg: 'rgba(37,99,235,0.05)',   color: C.blue,  border: 'rgba(37,99,235,0.15)'  },
    warning: { bg: 'rgba(201,123,6,0.05)',   color: C.amber, border: 'rgba(201,123,6,0.15)'  },
    success: { bg: 'rgba(14,164,114,0.05)',  color: C.green, border: 'rgba(14,164,114,0.15)' },
  }[type] || {}
  return (
    <div style={{
      padding: '10px 13px', borderRadius: 7,
      background: th.bg, border: `1px solid ${th.border}`,
      color: th.color, fontSize: 12.5, lineHeight: 1.6,
    }}>
      {children}
    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
export function StatCard({ label, value, sub, color, icon: IconComp }) {
  // Detect animated dollar values: "$1,234,567"
  const isDollar = typeof value === 'string' && /^\$[0-9,]+$/.test(value)

  return (
    <div
      className="stat-card-hover"
      style={{
        background: 'white', border: `1px solid ${C.border}`,
        borderRadius: 10, padding: '18px 20px',
        position: 'relative', overflow: 'hidden',
        boxShadow: C.shSm,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color || C.navy, opacity: 0.7,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.text3,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}>
            {label}
          </div>
          <div
            className="stat-value"
            style={{
              fontSize: 23, fontWeight: 700,
              color: color || C.text1,
              fontFamily: 'var(--mono)',
              letterSpacing: '-0.02em', lineHeight: 1.1,
            }}
          >
            {isDollar
              ? <AnimatedDollar raw={value.slice(1)} />
              : value
            }
          </div>
          {sub && <div style={{ fontSize: 11.5, color: C.text4, marginTop: 7 }}>{sub}</div>}
        </div>
        {IconComp && (
          <div style={{
            width: 36, height: 36, borderRadius: 9, flexShrink: 0,
            background: color ? `${color}14` : C.surface3,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: color ? `1px solid ${color}22` : `1px solid ${C.border}`,
          }}>
            <IconComp size={17} color={color || C.text3} />
          </div>
        )}
      </div>
    </div>
  )
}

// ── CPSearch ──────────────────────────────────────────────────────────────────
export function CPSearch({ list = [], value, onChange, label }) {
  const { t } = useLang()
  const [q, setQ]       = useState('')
  const [open, setOpen] = useState(false)
  const sel = list.find(c => c.id === value)

  const filtered = useMemo(() => {
    if (!q) return list
    const lq = q.toLowerCase()
    return list.filter(c =>
      (c.name    || '').toLowerCase().includes(lq) ||
      (c.name_ar || '').includes(q) ||
      (c.code    || '').toLowerCase().includes(lq)
    )
  }, [list, q])

  const tb = {
    customer: { bg: C.blueBg,   color: C.blue   },
    supplier: { bg: C.amberBg,  color: C.amber  },
    both:     { bg: C.greenBg,  color: C.green  },
    founder:  { bg: C.purpleBg, color: C.purple },
  }
  const tl = { customer: t.cpCustomer, supplier: t.cpSupplier, both: t.cpBoth, founder: t.cpFounder }

  return (
    <div>
      {label && <div style={{ fontSize: 12, fontWeight: 500, color: C.text2, marginBottom: 5 }}>{label}</div>}
      <div style={{ position: 'relative' }}>
        {sel && !open ? (
          <div
            onClick={() => setOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 11px',
              border: `1px solid ${C.navy3}`,
              borderRadius: 7, background: 'rgba(26,46,72,0.03)',
              cursor: 'pointer',
              transition: 'box-shadow 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 500, fontSize: 13.5 }}>{sel.name}</span>
              {sel.name_ar && <span style={{ fontSize: 12, color: C.text3 }} dir="rtl">{sel.name_ar}</span>}
              {sel.type && (
                <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, ...tb[sel.type] }}>
                  {tl[sel.type]}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(''); setQ('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, fontSize: 15, padding: '0 2px', display: 'flex' }}
            >✕</button>
          </div>
        ) : (
          <input
            value={q}
            onChange={e => { setQ(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={t.searchNameCode}
            style={{
              width: '100%', padding: '8px 11px',
              border: `1px solid ${C.border}`,
              borderRadius: 7, fontSize: 13.5,
              fontFamily: 'var(--font)', outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        )}
        {open && (
          <div style={{
            position: 'absolute', zIndex: 40, width: '100%', background: 'white',
            border: `1px solid ${C.border}`, borderRadius: 9, marginTop: 4,
            boxShadow: C.shLg, maxHeight: 210, overflowY: 'auto',
            animation: 'fadeUp 0.15s ease both',
          }}>
            {filtered.map(c => (
              <div
                key={c.id}
                onMouseDown={() => { onChange(c.id); setQ(''); setOpen(false) }}
                style={{
                  padding: '9px 14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: value === c.id ? C.surface3 : 'white',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.surface2}
                onMouseLeave={e => e.currentTarget.style.background = value === c.id ? C.surface3 : 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 500, fontSize: 13.5 }}>{c.name}</span>
                  {c.name_ar && <span style={{ fontSize: 11.5, color: C.text3 }} dir="rtl">{c.name_ar}</span>}
                </div>
                {c.type && (
                  <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 99, ...tb[c.type] }}>
                    {tl[c.type]}
                  </span>
                )}
              </div>
            ))}
            {!filtered.length && (
              <div style={{ padding: 16, textAlign: 'center', color: C.text3, fontSize: 13 }}>{t.notFound}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── LocAccPicker ──────────────────────────────────────────────────────────────
export function LocAccPicker({ locations = [], accounts = [], locVal, onLoc, accVal, onAcc, label }) {
  const { t } = useLang()
  const locAccounts = accounts.filter(a => a.location_id === locVal)
  const selAcc = accounts.find(a => a.id === accVal)
  const icons  = { cash: '💵', bank: '🏦', crypto: '₿' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 500, color: C.text2 }}>{label}</div>}
      <Select value={locVal || ''} onChange={e => { onLoc(e.target.value); onAcc('') }}>
        <option value="">{t.selectLocation}</option>
        {locations.map(l => <option key={l.id} value={l.id}>{l.name_tr}</option>)}
      </Select>
      {locVal && (
        <Select value={accVal || ''} onChange={e => onAcc(e.target.value)}>
          <option value="">{t.selectSafe}</option>
          {locAccounts.map(a => (
            <option key={a.id} value={a.id}>{icons[a.account_type]} {a.name} · {a.currency?.code}</option>
          ))}
        </Select>
      )}
      {selAcc && (
        <div style={{ fontSize: 12, color: C.green, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: C.green, display: 'inline-block' }} />
          {selAcc.currency?.code} · {selAcc.location?.name_tr || ''}
        </div>
      )}
    </div>
  )
}
