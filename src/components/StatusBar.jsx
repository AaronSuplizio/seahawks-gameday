import { useState, useEffect } from 'react'

function useSecondsSince(isoString) {
  const [seconds, setSeconds] = useState(null)
  useEffect(() => {
    if (!isoString) return
    const tick = () => setSeconds(Math.floor((Date.now() - new Date(isoString).getTime()) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isoString])
  return seconds
}

function formatAge(s) {
  if (s === null || s < 0) return null
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function StatusBar({ connected, updatedAt, updatedBy, onRefresh, onShare, shareCopied }) {
  const seconds = useSecondsSince(updatedAt)
  const age = formatAge(seconds)

  const updatedMsg = age
    ? updatedBy
      ? `· Last updated by ${updatedBy} ${age}`
      : `· Last updated ${age}`
    : null

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`connection-dot ${connected ? 'dot-connected' : 'dot-disconnected'}`} />
        <span className="connection-label">{connected ? 'Live' : 'Offline'}</span>
        {updatedMsg && <span className="last-updated">{updatedMsg}</span>}
      </div>
      <div className="status-right">
        <button className="btn-status btn-status-left" onClick={() => window.location.reload()}>
          ↻ <span className="btn-status-label">Refresh App</span>
        </button>
        <button className="btn-status btn-status-right" onClick={onShare}>
          {shareCopied ? 'Copied!' : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                <polyline points="16 6 12 2 8 6"/>
                <line x1="12" y1="2" x2="12" y2="15"/>
              </svg>
              <span className="btn-status-label">Share App</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
