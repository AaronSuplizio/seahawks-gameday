import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div style={{
        minHeight: '100svh',
        background: '#002244',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '32px',
        fontFamily: 'system-ui, sans-serif',
        color: '#7a93a8',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem' }}>🏈</div>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff' }}>
          App Updated
        </div>
        <div style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>
          A new version of Seahawks Sideline is available. Tap below to reload.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: '#69BE28',
            color: '#002244',
            border: 'none',
            borderRadius: '10px',
            padding: '14px 28px',
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: '1rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Reload App
        </button>
      </div>
    )
  }
}
