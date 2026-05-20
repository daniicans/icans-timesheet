import { useState, useEffect } from 'react'
import { formatFullDate, calcHours, formatHours } from '../utils/time.js'

export default function LogModal({ dateStr, existing, rate, onSave, onCancel }) {
  const [start, setStart] = useState(existing?.start || '')
  const [end, setEnd] = useState(existing?.end || '')
  const [note, setNote] = useState(existing?.note || '')

  const hours = calcHours(start, end)
  const earnings = (hours * rate).toFixed(2)
  const canSave = start && end && hours > 0

  function handleSave() {
    if (!canSave) return
    onSave({ start, end, note: note.trim() })
  }

  // close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  // close on Escape
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
