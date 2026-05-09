import { useEffect, useRef, useState } from 'react'

function AnimatedScore({ value, extraClass }) {
  const [flash, setFlash] = useState(false)
  const prev = useRef(value)

  useEffect(() => {
    if (value !== prev.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 700)
      prev.current = value
      return () => clearTimeout(t)
    }
  }, [value])

  return (
    <span className={`score-number ${extraClass} ${flash ? 'score-flash' : ''}`}>
      {value}
    </span>
  )
}

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

export default function Scoreboard({ seahawksScore, opponentScore, quarter }) {
  return (
    <div className="scoreboard">
      <div className="scoreboard-inner">
        <div className="score-block">
          <div className="score-team-name seahawks-name">SEAHAWKS</div>
          <AnimatedScore value={seahawksScore} extraClass="seahawks-score-color" />
        </div>

        <div className="scoreboard-center">
          <div className="quarter-badge">{QUARTER_LABELS[quarter - 1] ?? `Q${quarter}`}</div>
          <div className="score-colon">:</div>
        </div>

        <div className="score-block">
          <div className="score-team-name opponent-name">OPP</div>
          <AnimatedScore value={opponentScore} extraClass="opponent-score-color" />
        </div>
      </div>
    </div>
  )
}
