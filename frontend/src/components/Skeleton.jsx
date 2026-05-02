/**
 * Skeleton — GPU-accelerated shimmer placeholder.
 * Prevents CLS (Cumulative Layout Shift) by reserving space
 * before data loads, instead of showing "Yükleniyor..." text.
 *
 * Uses CSS animation on `opacity` + `transform` (GPU composited).
 */

const shimmerStyle = {
  background: 'linear-gradient(90deg, #EEF2F7 25%, #F8FAFC 50%, #EEF2F7 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 6,
}

export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...shimmerStyle,
        width,
        height,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  )
}

/** One table row of skeleton cells */
export function SkeletonRow({ cols = 4 }) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #E5EAF0' }}>
          <Skeleton height={14} width={i === 0 ? '70%' : '55%'} />
        </td>
      ))}
    </tr>
  )
}

/** Full-width centered spinner for page-level loading */
export function PageSpinner() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 200, gap: 10, color: '#8898AA', fontSize: 13,
    }}>
      <div style={{
        width: 18, height: 18,
        border: '2px solid #E5EAF0',
        borderTopColor: '#C9A84C',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }} />
      Yükleniyor...
    </div>
  )
}
