const BUTTONS = [
  { label: '+6', delta: 6, title: 'Touchdown' },
  { label: '+1', delta: 1, title: 'PAT / Extra Point' },
  { label: '+2', delta: 2, title: '2-Point Conversion' },
  { label: '−1', delta: -1, title: 'Undo / Correct Score', undo: true },
]

export default function ScoreControls({ team, onAdjust }) {
  return (
    <div className="score-buttons">
      {BUTTONS.map(({ label, delta, title, undo }) => (
        <button
          key={label}
          className={`btn ${undo ? 'btn-undo' : 'btn-score'}`}
          onClick={() => onAdjust(team, delta)}
          title={title}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
