import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function patchTimer(patch) {
  await supabase.from('game_state').update(patch).eq('id', 1)
}

export default function Timer({ game, isAdmin, onReset, onFinal, isFinal, confirmingReset, setConfirmingReset }) {
  const timerSeconds = game.timer_seconds ?? 600
  const timerRunning = !!game.timer_running
  const timerEndAt = game.timer_end_at
  const timerPausedRemaining = game.timer_paused_remaining

  const [, setTick] = useState(0)

  // Set Clock modal (MM:SS — adjusts current countdown)
  const [showSetClock, setShowSetClock] = useState(false)
  const [minInput, setMinInput] = useState('0')
  const [secInput, setSecInput] = useState('0')
  const minRef = useRef(null)

  // Quarter Duration modal (minutes only — sets default quarter length)
  const [showSetDuration, setShowSetDuration] = useState(false)
  const [durInput, setDurInput] = useState('')
  const durRef = useRef(null)

  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => setTick(t => t + 1), 250)
    return () => clearInterval(id)
  }, [timerRunning])

  function getRemaining() {
    if (timerRunning && timerEndAt) {
      return Math.max(0, (new Date(timerEndAt) - Date.now()) / 1000)
    }
    if (!timerRunning && timerPausedRemaining != null) {
      return timerPausedRemaining
    }
    return timerSeconds
  }

  const remaining = getRemaining()
  const isExpired = remaining <= 0
  const isPaused = !timerRunning && timerPausedRemaining != null
  const isReset = !timerRunning && timerPausedRemaining == null

  // Set Clock validation
  const minVal = parseInt(minInput) || 0
  const secVal = parseInt(secInput) || 0
  const minTooHigh = minVal > 99
  const secTooHigh = secVal > 59
  const clockInvalid = minTooHigh || secTooHigh || (minVal === 0 && secVal === 0)

  // Quarter Duration validation
  const durVal = parseInt(durInput) || 0
  const durInvalid = durVal < 1 || durVal > 99

  function openSetClock() {
    const r = Math.round(getRemaining())
    setMinInput(String(Math.floor(r / 60)))
    setSecInput(String(r % 60))
    setShowSetClock(true)
  }

  function openSetDuration() {
    setDurInput(String(Math.round(timerSeconds / 60)))
    setShowSetDuration(true)
  }

  async function applyClock() {
    if (clockInvalid) return
    const total = minVal * 60 + secVal
    await patchTimer({
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: total,
    })
    setShowSetClock(false)
  }

  async function applyDuration() {
    if (durInvalid) return
    const total = durVal * 60
    await patchTimer({
      timer_seconds: total,
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: null,
    })
    setShowSetDuration(false)
  }

  async function start() {
    const r = getRemaining()
    if (r <= 0) return
    await patchTimer({
      timer_running: true,
      timer_end_at: new Date(Date.now() + r * 1000).toISOString(),
      timer_paused_remaining: null,
    })
  }

  async function pause() {
    await patchTimer({
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: Math.round(getRemaining()),
    })
  }

  let statusClass = 'timer-paused'
  if (timerRunning) statusClass = 'timer-running'
  else if (isExpired && !isReset) statusClass = 'timer-expired'

  const quarterMins = Math.round(timerSeconds / 60)

  return (
    <div className="timer-section">
      <div className="timer-label">UNOFFICIAL GAME CLOCK</div>
      <div
        className={`timer-display ${statusClass}${isAdmin && !timerRunning ? ' timer-display-clickable' : ''}`}
        onClick={isAdmin && !timerRunning ? openSetClock : undefined}
      >
        {fmt(remaining)}
      </div>

      {isAdmin && (
        <div className="timer-controls">
          <div className="admin-actions-box">
            <div className="admin-actions-label">ADMIN</div>
            {confirmingReset ? (
              <div className="admin-actions-grid">
                <button className="btn-admin btn-admin-confirm" onClick={onReset}>✓ Confirm Reset</button>
                <button className="btn-admin btn-admin-cancel" onClick={() => setConfirmingReset(false)}>✕ Cancel</button>
              </div>
            ) : (
              <div className="admin-actions-grid">
                {timerRunning ? (
                  <button className="btn-admin btn-admin-pause" onClick={pause}>⏸ Pause</button>
                ) : (
                  <button className="btn-admin btn-admin-start" onClick={start} disabled={isExpired}>
                    ▶ {isReset ? 'Start' : 'Resume'}
                  </button>
                )}
                <button className="btn-admin btn-admin-setclock" onClick={openSetClock} disabled={timerRunning}>
                  ✎ Set Clock
                </button>
                <button className="btn-admin btn-admin-reset" onClick={() => setConfirmingReset(true)}>
                  Reset Score
                </button>
                <button className="btn-admin btn-admin-final" onClick={onFinal}>
                  {isFinal ? 'Undo Final' : 'Final Score'}
                </button>
                <button className="btn-admin btn-admin-duration" onClick={openSetDuration}>
                  {quarterMins} Min Quarters
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Set Clock modal — MM:SS */}
      {showSetClock && (
        <div className="timer-set-overlay" onClick={() => setShowSetClock(false)}>
          <div className="timer-set-card" onClick={e => e.stopPropagation()}>
            <div className="timer-set-title">Set Game Clock</div>
            <div className="timer-set-inputs">
              <div className="timer-set-col">
                <input
                  ref={minRef}
                  className={`timer-set-input${minTooHigh ? ' timer-set-input-error' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={minInput}
                  autoFocus
                  onChange={e => setMinInput(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') applyClock(); if (e.key === 'Escape') setShowSetClock(false) }}
                />
                <div className="timer-set-unit">MIN</div>
              </div>
              <div className="timer-set-colon">:</div>
              <div className="timer-set-col">
                <input
                  className={`timer-set-input${secTooHigh ? ' timer-set-input-error' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={secInput}
                  onChange={e => setSecInput(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') applyClock(); if (e.key === 'Escape') setShowSetClock(false) }}
                />
                <div className="timer-set-unit">SEC</div>
              </div>
            </div>
            <div className="timer-set-actions">
              <button className="btn timer-set-cancel" onClick={() => setShowSetClock(false)}>Cancel</button>
              <button className="btn timer-set-confirm" onClick={applyClock} disabled={clockInvalid}>Set Clock</button>
            </div>
          </div>
        </div>
      )}

      {/* Quarter Duration modal — minutes only */}
      {showSetDuration && (
        <div className="timer-set-overlay" onClick={() => setShowSetDuration(false)}>
          <div className="timer-set-card" onClick={e => e.stopPropagation()}>
            <div className="timer-set-title">Quarter Duration</div>
            <div className="timer-set-inputs">
              <div className="timer-set-col" style={{ maxWidth: '100%', width: '100%' }}>
                <input
                  ref={durRef}
                  className={`timer-set-input${durInvalid && durInput !== '' ? ' timer-set-input-error' : ''}`}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={durInput}
                  autoFocus
                  onChange={e => setDurInput(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') applyDuration(); if (e.key === 'Escape') setShowSetDuration(false) }}
                />
                <div className="timer-set-unit">MIN</div>
              </div>
            </div>
            <div className="timer-set-actions">
              <button className="btn timer-set-cancel" onClick={() => setShowSetDuration(false)}>Cancel</button>
              <button className="btn timer-set-confirm" onClick={applyDuration} disabled={durInvalid}>Set Duration</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
