import { useState, useEffect } from 'react'

export default function SettingsModal({ settings, onSave, onCancel }) {
  const [name, setName] = useState(settings.name)
  const [email, setEmail] = useState(settings.email)
  const [katherineEmail, setKatherineEmail] = useState(settings.katherineEmail || 'katherine@icans.ai')
  const [rate, setRate] = useState(settings.rate)
  const [logMode, setLogMode] = useState(settings.logMode || 'time')

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onCancel()
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onCancel])

  function handleSave() {
    onSave({ name: name.trim(), email: email.trim(), katherineEmail: katherineEmail.trim(), rate: Number(rate), logMode })
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-sheet">
        <div className="modal-header">
          <div className="modal-day">Settings</div>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <div className="settings-field">
            <label>Your Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="settings-field">
            <label>Your Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="settings-field">
            <label>Katherine's Email</label>
            <input type="email" value={katherineEmail} onChange={(e) => setKatherineEmail(e.target.value)} />
          </div>
          <div className="settings-field">
            <label>Hourly Rate ($)</label>
            <input type="number" value={rate} min="1" step="0.50" onChange={(e) => setRate(e.target.value)} />
          </div>
          <div className="settings-field">
            <label>Log Mode</label>
            <div className="log-mode-toggle">
              <button
                className={`toggle-btn ${logMode === 'time' ? 'active' : ''}`}
                onClick={() => setLogMode('time')}
                type="button"
              >
                🕐 Clock In / Out
              </button>
              <button
                className={`toggle-btn ${logMode === 'hours' ? 'active' : ''}`}
                onClick={() => setLogMode('hours')}
                type="button"
              >
                # Hours Only
              </button>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  )
}
