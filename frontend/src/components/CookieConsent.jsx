import { useState, useEffect } from 'react'

const STORAGE_KEY = 'safiron_cookie_consent'

/* Consent Mode güncelle — script zaten index.html'de, sadece izin veriyoruz */
function grantAnalytics() {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'granted' })
  }
}

function denyAnalytics() {
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', { analytics_storage: 'denied' })
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'accepted') { grantAnalytics(); return }
    if (stored === 'rejected') { denyAnalytics(); return }
    // İlk ziyaret — 800ms sonra göster
    const t = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(t)
  }, [])

  const dismiss = (decision) => {
    setLeaving(true)
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, decision)
      if (decision === 'accepted') grantAnalytics()
      else denyAnalytics()
      setVisible(false)
    }, 350)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position:   'fixed',
        bottom:      0,
        left:        0,
        right:       0,
        zIndex:      9999,
        padding:    '0 0 env(safe-area-inset-bottom)',
        transform:   leaving ? 'translateY(100%)' : 'translateY(0)',
        transition:  'transform .35s cubic-bezier(.4,0,.2,1)',
      }}
    >
      <div style={{
        background:       'rgba(8, 15, 28, 0.95)',
        backdropFilter:   'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop:        '1px solid rgba(201,168,76,0.25)',
        padding:          '20px 24px',
      }}>
        <div style={{
          maxWidth:     '1100px',
          margin:       '0 auto',
          display:      'flex',
          alignItems:   'center',
          gap:          '20px',
          flexWrap:     'wrap',
        }}>
          {/* İkon */}
          <div style={{
            width:          '40px',
            height:         '40px',
            borderRadius:   '10px',
            background:     'rgba(201,168,76,0.15)',
            border:         '1px solid rgba(201,168,76,0.3)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '18px',
            flexShrink:      0,
          }}>🍪</div>

          {/* Metin */}
          <div style={{ flex: 1, minWidth: '260px' }}>
            <p style={{
              margin:     0,
              fontSize:   '13.5px',
              color:      '#CBD5E1',
              lineHeight: '1.6',
            }}>
              <span style={{ color: '#fff', fontWeight: 600 }}>Çerez Bildirimi — </span>
              Safiron Havale, ziyaretçi deneyimini iyileştirmek ve kullanım istatistiklerini
              analiz etmek amacıyla{' '}
              <span style={{ color: '#C9A84C' }}>Google Analytics</span> çerezleri kullanmaktadır.
              Bu çerezler kişisel kimliğinizi açığa çıkarmaz.{' '}
              <a href="/gizlilik-politikasi" style={{ color: '#94A3B8', fontSize: '12px', textDecoration: 'underline' }}>
                6698 sayılı KVKK kapsamında bilginize sunulur.
              </a>
            </p>
          </div>

          {/* Butonlar */}
          <div style={{
            display:    'flex',
            gap:        '10px',
            flexShrink:  0,
            flexWrap:   'wrap',
          }}>
            <button
              onClick={() => dismiss('rejected')}
              style={{
                padding:      '9px 20px',
                borderRadius: '8px',
                border:       '1px solid rgba(148,163,184,0.3)',
                background:   'transparent',
                color:        '#94A3B8',
                fontSize:     '13px',
                fontWeight:   500,
                cursor:       'pointer',
                transition:   'all .2s',
                fontFamily:   'inherit',
                whiteSpace:   'nowrap',
              }}
              onMouseEnter={e => {
                e.target.style.borderColor = 'rgba(148,163,184,0.6)'
                e.target.style.color = '#CBD5E1'
              }}
              onMouseLeave={e => {
                e.target.style.borderColor = 'rgba(148,163,184,0.3)'
                e.target.style.color = '#94A3B8'
              }}
            >
              Reddet
            </button>

            <button
              onClick={() => dismiss('accepted')}
              style={{
                padding:      '9px 24px',
                borderRadius: '8px',
                border:       'none',
                background:   'linear-gradient(135deg, #C9A84C, #E8C96A)',
                color:        '#0D1B2E',
                fontSize:     '13px',
                fontWeight:   700,
                cursor:       'pointer',
                transition:   'all .2s',
                fontFamily:   'inherit',
                whiteSpace:   'nowrap',
                boxShadow:    '0 2px 12px rgba(201,168,76,0.3)',
              }}
              onMouseEnter={e => {
                e.target.style.transform = 'translateY(-1px)'
                e.target.style.boxShadow = '0 4px 16px rgba(201,168,76,0.45)'
              }}
              onMouseLeave={e => {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 2px 12px rgba(201,168,76,0.3)'
              }}
            >
              Kabul Et
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
