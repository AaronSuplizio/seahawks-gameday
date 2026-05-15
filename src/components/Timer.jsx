import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

function fmt(seconds) {
  const s = Math.max(0, Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

async function patchTimer(patch) {
  await supabase.from('game_state').update(patch).eq('id', 1)
}

export default function Timer({ game, isAdmin }) {
  const timerSeconds = game.timer_seconds ?? 600
  const timerRunning = !!game.timer_running
  const timerEndAt = game.timer_end_at
  const timerPausedRemaining = game.timer_paused_remaining

  const [, setTick] = useState(0)
  const [showSetClock, setShowSetClock] = useState(false)
  const [minInput, setMinInput] = useState('0')
  const [secInput, setSecInput] = useState('0')
  const minRef = useRef(null)

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

  const maxMins = Math.floor(timerSeconds / 60)
  const minVal = parseInt(minInput) || 0
  const secVal = parseInt(secInput) || 0
  const minTooHigh = minVal > maxMins
  const secTooHigh = secVal > 59
  const clockInvalid = minTooHigh || secTooHigh || (minVal === 0 && secVal === 0)

  function openSetClock() {
    const r = Math.round(getRemaining())
    setMinInput(String(Math.floor(r / 60)))
    setSecInput(String(r % 60))
    setShowSetClock(true)
    setTimeout(() => minRef.current?.select(), 50)
  }

  function closeSetClock() {
    setShowSetClock(false)
  }

  async function applyClock() {
    if (clockInvalid) return
    const total = minVal * 60 + secVal
    await patchTimer({
      timer_seconds: total,
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: null,
    })
    setShowSetClock(false)
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

  async function reset() {
    await patchTimer({
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: null,
    })
  }

  let statusClass = 'timer-paused'
  if (timerRunning) statusClass = 'timer-running'
  else if (isExpired && !isReset) statusClass = 'timer-expired'

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
          {timerRunning ? (
            <button className="btn-timer" onClick={pause}>⏸ Pause</button>
          ) : (
            <button className="btn-timer btn-timer-primary" onClick={start} disabled={isExpired && isReset}>
              ▶ {isPaused ? 'Resume' : 'Start'}
            </button>
          )}
          <button className="btn-timer" onClick={reset}>↺ Reset</button>
          {!timerRunning && (
            <button className="btn-timer btn-timer-config" onClick={openSetClock}>
              ✎ Set Clock
            </button>
          )}
        </div>
      )}

      {showSetClock && (
        <div className="timer-set-overlay" onClick={closeSetClock}>
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
                  onChange={e => setMinInput(e.target.value.replace(/\D/g, ''))}
                  onFocus={e => e.target.select()}
                  onKeyDown={e => { if (e.key === 'Enter') applyClock(); if (e.key === 'Escape') closeSetClock() }}
                />
                <div className="timer-set-unit">MIN</div>
                <div className={`timer-set-hint${minTooHigh ? ' timer-set-hint-error' : ''}`}>max {maxMins}</div>
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
                  onKeyDown={e => { if (e.key === 'Enter') applyClock(); if (e.key === 'Escape') closeSetClock() }}
                />
                <div className="timer-set-unit">SEC</div>
                <div className={`timer-set-hint${secTooHigh ? ' timer-set-hint-error' : ''}`}>max 59</div>
              </div>
            </div>
            <div className="timer-set-actions">
              <button className="btn timer-set-cancel" onClick={closeSetClock}>Cancel</button>
              <button className="btn timer-set-confirm" onClick={applyClock} disabled={clockInvalid}>Set Clock</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
