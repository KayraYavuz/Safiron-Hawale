import { Component } from 'react'

/**
 * ErrorBoundary — catches render errors in child tree.
 * Shows a minimal fallback instead of crashing the whole app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // In production, send to error tracking (Sentry, etc.)
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: 300, gap: 12,
          padding: 32, textAlign: 'center',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'rgba(229,62,62,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>
            ⚠️
          </div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#0D1B2E' }}>
            Bir hata oluştu
          </div>
          <div style={{ fontSize: 13, color: '#8898AA', maxWidth: 320 }}>
            Bu sayfa yüklenirken beklenmedik bir hata oluştu.
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: 8, padding: '8px 12px',
              background: '#FFF5F5', border: '1px solid rgba(229,62,62,0.2)',
              borderRadius: 6, fontSize: 11, color: '#E53E3E',
              maxWidth: 480, overflow: 'auto', textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 4, padding: '8px 20px', borderRadius: 7,
              background: '#0D1B2E', color: 'white', border: 'none',
              fontSize: 13, fontWeight: 500, cursor: 'pointer',
              fontFamily: 'var(--font)',
            }}
          >
            Yeniden Dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
