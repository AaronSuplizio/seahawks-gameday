import { useState, useEffect } from 'react'
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
  const [editingDuration, setEditingDuration] = useState(false)
  const [durationInput, setDurationInput] = useState('')

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

  async function setDuration() {
    const mins = parseFloat(durationInput)
    if (!mins || mins <= 0) return
    await patchTimer({
      timer_seconds: Math.round(mins * 60),
      timer_running: false,
      timer_end_at: null,
      timer_paused_remaining: null,
    })
    setEditingDuration(false)
  }

  let statusClass = 'timer-paused'
  if (timerRunning) statusClass = 'timer-running'
  else if (isExpired && !isReset) statusClass = 'timer-expired'

  return (
    <div className="timer-section">
      <div className="timer-label">QUARTER TIMER</div>
      <div className={`timer-display ${statusClass}`}>{fmt(remaining)}</div>

      {isAdmin && (
        <div className="timer-controls">
          {timerRunning ? (
            <button className="btn-timer" onClick={pause}>⏸ Pause</button>
          ) : (
            <button className="btn-timer btn-timer-primary" onClick={start} disabled={isExpired && !isReset}>
              ▶ {isPaused ? 'Resume' : 'Start'}
            </button>
          )}
          <button className="btn-timer" onClick={reset}>↺ Reset</button>

          {isReset && !editingDuration && (
            <button
              className="btn-timer btn-timer-config"
              onClick={() => { setDurationInput(String(Math.round(timerSeconds / 60))); setEditingDuration(true) }}
            >
              {Math.round(timerSeconds / 60)}m ✎
            </button>
          )}
          {isReset && editingDuration && (
            <div className="timer-duration-row">
              <input
                className="timer-duration-input"
                type="number"
                min="1"
                max="99"
                value={durationInput}
                onChange={e => setDurationInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') setDuration(); if (e.key === 'Escape') setEditingDuration(false) }}
                autoFocus
              />
              <span className="timer-duration-unit">min</span>
              <button className="btn-timer btn-timer-primary" onClick={setDuration}>Set</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
