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

export default function StatusBar({ connected, updatedAt, updatedBy, onRefresh }) {
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
      <button className="btn btn-refresh" onClick={onRefresh}>↻ Refresh</button>
    </div>
  )
}
