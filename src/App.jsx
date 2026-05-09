import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Scoreboard from './components/Scoreboard'
import ScoreControls from './components/ScoreControls'
import QuarterControls from './components/QuarterControls'
import StatusBar from './components/StatusBar'
import Chat, { JoinPrompt } from './components/Chat'

const DEFAULT_GAME = { id: 1, seahawks_score: 0, opponent_score: 0, quarter: 1, updated_at: null }

async function persist(patch) {
  const { error } = await supabase
    .from('game_state')
    .upsert({ id: 1, ...patch, updated_at: new Date().toISOString() })
  return error
}

export default function App() {
  const [game, setGame] = useState(DEFAULT_GAME)
  const [connected, setConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [chatName, setChatName] = useState(() => localStorage.getItem('chat_name'))

  const fetchGame = useCallback(async () => {
    const { data, error: fetchErr } = await supabase
      .from('game_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle()

    if (fetchErr) {
      setDbError(`Read failed: ${fetchErr.message}`)
      setLoading(false)
      return
    }

    if (data) setGame(data)
    setLoading(false)
  }, [])

  // Optimistic update: apply change locally immediately, then write to DB.
  // If the write fails, revert and show the error.
  const optimisticUpdate = useCallback(async (patch) => {
    setDbError(null)
    setGame(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }))
    const error = await persist(patch)
    if (error) {
      setDbError(`Save failed: ${error.message}`)
      fetchGame() // revert to server state
    }
  }, [fetchGame])

  const adjustScore = useCallback((team, delta) => {
    const key = team === 'seahawks' ? 'seahawks_score' : 'opponent_score'
    const current = team === 'seahawks' ? game.seahawks_score : game.opponent_score
    const newValue = Math.max(0, current + delta)
    const patch = {
      seahawks_score: game.seahawks_score,
      opponent_score: game.opponent_score,
      quarter: game.quarter,
      [key]: newValue,
    }
    setGame(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }))
    persist(patch).then(err => {
      if (err) { setDbError(`Save failed: ${err.message}`); fetchGame() }
    })
  }, [game, fetchGame])

  const setQuarter = useCallback((q) => {
    const quarter = Math.min(4, Math.max(1, q))
    const patch = { seahawks_score: game.seahawks_score, opponent_score: game.opponent_score, quarter }
    setGame(prev => ({ ...prev, quarter, updated_at: new Date().toISOString() }))
    persist(patch).then(err => {
      if (err) { setDbError(`Save failed: ${err.message}`); fetchGame() }
    })
  }, [game, fetchGame])

  const resetGame = useCallback(async () => {
    const patch = { seahawks_score: 0, opponent_score: 0 }
    setConfirmingReset(false)
    setGame(prev => ({ ...prev, ...patch, updated_at: new Date().toISOString() }))
    const error = await persist({ ...patch, quarter: game.quarter })
    if (error) { setDbError(`Reset failed: ${error.message}`); fetchGame() }
  }, [game.quarter, fetchGame])

  useEffect(() => {
    fetchGame()

    // No row-level filter here — only one row exists, and filters on UPDATE
    // require REPLICA IDENTITY FULL which we haven't set.
    const channel = supabase
      .channel('game_state_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_state' },
        (payload) => { if (payload.new?.id === 1) setGame(payload.new) }
      )
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [fetchGame])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <div className="loading-text">Loading game...</div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Seahawks Gameday</h1>
        <StatusBar connected={connected} updatedAt={game.updated_at} onRefresh={fetchGame} />
      </header>

      {dbError && (
        <div className="db-error">
          ⚠ {dbError}
        </div>
      )}

      <main className="app-main">
        <Scoreboard
          seahawksScore={game.seahawks_score}
          opponentScore={game.opponent_score}
          quarter={game.quarter}
        />

        <section className="controls-section">
          <div className="score-controls-row">
            <div className="team-controls">
              <div className="team-controls-label seahawks-label">SEAHAWKS</div>
              <ScoreControls team="seahawks" onAdjust={adjustScore} />
            </div>
            <div className="controls-divider" />
            <div className="team-controls">
              <div className="team-controls-label opponent-label">OPPONENT</div>
              <ScoreControls team="opponent" onAdjust={adjustScore} />
            </div>
          </div>

          <QuarterControls quarter={game.quarter} onSetQuarter={setQuarter} />

          {confirmingReset ? (
            <div className="reset-confirm">
              <span className="reset-confirm-label">Zero out scores?</span>
              <button className="btn btn-reset-confirm" onClick={resetGame}>Yes, reset</button>
              <button className="btn btn-reset-cancel" onClick={() => setConfirmingReset(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-reset" onClick={() => setConfirmingReset(true)}>
              Reset Score
            </button>
          )}
        </section>

        <section className="chat-section">
          {chatName ? (
            <Chat
              name={chatName}
              onChangeName={() => { localStorage.removeItem('chat_name'); setChatName(null) }}
            />
          ) : (
            <JoinPrompt onJoin={name => { localStorage.setItem('chat_name', name); setChatName(name) }} />
          )}
        </section>
      </main>
    </div>
  )
}
