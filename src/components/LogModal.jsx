import { useState, useEffect } from 'react'
import { formatFullDate, calcHours, calcEntryHours, formatHours } from '../utils/time.js'

export default function LogModal({ dateStr, existing, rate, logMode, onSave, onCancel }) {
  const isHoursMode = logMode === 'hours'

  const [start, setStart] = useState(existing?.start || '')
  const [end, setEnd] = useState(existing?.end || '')
  const [hoursInput, setHoursInput] = useState(
    existing?.hours != null ? String(existing.hours) : ''
  )
  const [note, setNote] = useState(existing?.note || '')

  const hours = isHoursMode
    ? (parseFloat(hoursInput) || 0)
    : calcHours(start, end)
  const earnings = (hours * rate).toFixed(2)
  const canSave = isHoursMode ? hours > 0 : (start && end && hours > 0)

  function handleSave() {
    if (!canSave) return
    if (isHoursMode) {
      onSave({ hours: parseFloat(hoursInput), note: note.trim() })
    } else {
      onSave({ start, end, note: note.trim() })
    }
  }

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div>
            <div className="modal-day">{dateStr ? new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }) : ''}</div>
            <div className="modal-date">{dateStr ? formatFullDate(dateStr) : ''}</div>
          </div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body">
          {isHoursMode ? (
            <div className="time-field" style={{ width: '100%' }}>
              <label>Hours Worked</label>
              <input
                type="number"
                min="0"
                max="24"
                step="0.25"
                placeholder="e.g. 8 or 7.5"
                value={hoursInput}
                onChange={(e) => setHoursInput(e.target.value)}
                className={hoursInput ? 'filled' : ''}
                style={{ fontSize: '28px', textAlign: 'center', padding: '14px' }}
                autoFocus
              />
            </div>
          ) : (
            <div className="time-inputs">
              <div className="time-field">
                <label>Clock In</label>
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={start ? 'filled' : ''}
                />
              </div>
              <div className="time-field">
                <label>Clock Out</label>
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={end ? 'filled' : ''}
                />
              </div>
            </div>
          )}

          {canSave && (
            <div className="preview-card">
              <span>{formatHours(hours)} hours</span>
              <span className="preview-earnings">${earnings}</span>
            </div>
          )}

          <div className="note-field">
            <label>Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. WFH, client meeting…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={80}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-save" onClick={handleSave} disabled={!canSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
