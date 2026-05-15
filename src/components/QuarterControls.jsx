export default function QuarterControls({ quarter, onSetQuarter, onHalftime, isHalftime }) {
  return (
    <div className="quarter-selector">
      <div className="quarter-row">
        {[1, 2].map((q) => (
          <button
            key={q}
            className={`btn btn-quarter ${quarter === q ? 'btn-quarter-active' : ''}`}
            onClick={() => onSetQuarter(q)}
          >
            Q{q}
          </button>
        ))}
      </div>
      <div className="quarter-row">
        <button
          className={`btn btn-quarter btn-quarter-halftime ${isHalftime ? 'btn-quarter-halftime-active' : ''}`}
          onClick={onHalftime}
        >
          {isHalftime ? 'Undo HT' : 'Halftime'}
        </button>
      </div>
      <div className="quarter-row">
        {[3, 4].map((q) => (
          <button
            key={q}
            className={`btn btn-quarter ${quarter === q ? 'btn-quarter-active' : ''}`}
            onClick={() => onSetQuarter(q)}
          >
            Q{q}
          </button>
        ))}
      </div>
    </div>
  )
}
