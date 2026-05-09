import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'

const MOMENTS = [
  { id: 'touchdown',    label: 'Touchdown!',                  emoji: '🏈', color: '#69BE28', vibrate: [100, 40, 100, 40, 400] },
  { id: 'interception', label: 'Interception!',               emoji: '🙌', color: '#4a90d9', vibrate: [200, 60, 300] },
  { id: 'chains',      label: 'First Down, Move the Chains!', emoji: '⛓️', color: '#c0a060', vibrate: [80, 40, 80] },
]

export default function Moments() {
  const [active, setActive] = useState(null)
  const channelRef = useRef(null)
  const timerRef = useRef(null)

  function showMoment(moment) {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (navigator.vibrate) navigator.vibrate(moment.vibrate)
    setActive({ ...moment, key: Date.now() })
    timerRef.current = setTimeout(() => setActive(null), 2800)
  }

  function fireMoment(moment) {
    showMoment(moment)
    channelRef.current?.send({ type: 'broadcast', event: 'moment', payload: { id: moment.id } })
  }

  useEffect(() => {
    channelRef.current = supabase
      .channel('game_moments')
      .on('broadcast', { event: 'moment' }, ({ payload }) => {
        const moment = MOMENTS.find(m => m.id === payload.id)
        if (moment) showMoment(moment)
      })
      .subscribe()

    return () => { supabase.removeChannel(channelRef.current) }
  }, [])

  return (
    <>
      <section className="moments-section">
        <div className="moments-label">GAME MOMENTS</div>
        <div className="moments-grid">
          {MOMENTS.map(moment => (
            <button
              key={moment.id}
              className="btn-moment"
              style={{ '--mc': moment.color }}
              onClick={() => fireMoment(moment)}
            >
              <span className="moment-emoji">{moment.emoji}</span>
              <span className="moment-label">{moment.label}</span>
            </button>
          ))}
        </div>
      </section>

      {active && (
        <div className="moment-overlay" key={active.key} style={{ '--mc': active.color }}>
          <div className="moment-overlay-content">
            <div className="moment-overlay-emoji">{active.emoji}</div>
            <div className="moment-overlay-text">{active.label}</div>
          </div>
        </div>
      )}
    </>
  )
}
