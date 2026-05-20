import { getDayLabel, getDayNum, isWeekend, isPast, isToday, isFuture, calcHours, formatHours, formatTime12 } from '../utils/time.js'

export default function DayRow({ dateStr, entry, rate, onLog, onEdit, onDelete }) {
  const dayLabel = getDayLabel(dateStr)
  const dayNum = getDayNum(dateStr)
  const weekend = isWeekend(dateStr)
  const past = isPast(dateStr)
  const today = isToday(dateStr)
  const future = isFuture(dateStr)
  const logged = !!(entry?.start && entry?.end)

  let accentColor = '#e2e8f0' // default gray
  if (logged) accentColor = '#22c55e'
  else if (today) accentColor = 'rgba(34,197,94,0.3)'
  else if (past && !weekend) accentColor = '#ef4444'

  const hours = logged ? calcHours(entry.start, entry.end) : 0
  const earnings = (hours * rate).toFixed(2)

  return (
    <div
      className="day-row"
      style={{ opacity: weekend && !logged ? 0.6 : 1 }}
    >
      <div className="day-accent" style={{ background: accentColor }} />
      <div className="day-label-col">
        <span className="day-name">{dayLabel}</span>
        <span className="day-num">{dayNum}</span>
      </div>
      <div className="day-content">
        {logged ? (
          <div className="logged-content">
            <div className="time-range">
              {formatTime12(entry.start)} → {formatTime12(entry.end)}
            </div>
            <div className="hours-row">
              <span className="hours-big">{formatHours(hours)} hrs</span>
              <span className="earnings">${earnings}</span>
            </div>
            {entry.note && <div className="note-text">{entry.note}</div>}
          </div>
        ) : (
          <button
            className={`log-btn ${past && !weekend ? 'missing' : ''}`}
            onClick={() => onLog(dateStr)}
          >
            {past && !weekend ? '⚠ Log missing time' : '+ Log time'}
          </button>
        )}
      </div>
      {logged && (
        <div className="day-actions">
          <button className="action-btn edit-btn" onClick={() => onEdit(dateStr)}>Edit</button>
          <button className="action-btn delete-btn" onClick={() => onDelete(dateStr)}>✕</button>
        </div>
      )}
    </div>
  )
}
