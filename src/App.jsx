import { useState, useEffect, useCallback } from 'react'
import {
  getThursdayOf, getPayPeriod, todayISO, formatDisplayRange,
  prevThursday, nextThursday, isWeekend, isPast, calcEntryHours, formatHours
} from './utils/time.js'
import {
  getSettings, saveSettings, defaultSettings,
  getPeriodEntries, saveEntry, deleteEntry, savePushSub
} from './utils/storage.js'
import DayRow from './components/DayRow.jsx'
import LogModal from './components/LogModal.jsx'
import PDFPreview from './components/PDFPreview.jsx'
import SettingsModal from './components/SettingsModal.jsx'

export default function App() {
  const [currentThursday, setCurrentThursday] = useState(() => getThursdayOf(todayISO()))
  const [entries, setEntries] = useState({})
  const [settings, setSettings] = useState(() => getSettings())
  const [logModal, setLogModal] = useState(null) // dateStr or null
  const [showPDF, setShowPDF] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  const today = todayISO()
  const todayThursday = getThursdayOf(today)
  const isCurrentPeriod = currentThursday === todayThursday
  const periodDates = getPayPeriod(currentThursday)

  // reload entries when period changes
  useEffect(() => {
    setEntries(getPeriodEntries(currentThursday))
  }, [currentThursday])

  // install prompt
  useEffect(() => {
    const dismissed = localStorage.getItem('icans_ts_install_dismissed')
    if (dismissed) return
    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
      setTimeout(() => setShowInstallBanner(true), 30000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // push notification subscription
  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })
      savePushSub(sub)
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub, userEmail: settings.email })
      })
    } catch {}
  }

  function handleLog(dateStr) {
    setLogModal(dateStr)
  }

  function syncToServer(thursdayStr, updatedEntries) {
    fetch('/api/sync-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: settings.email, thursdayStr, entries: updatedEntries })
    }).catch(() => {})
  }

  function syncSettingsToServer(s) {
    fetch('/api/sync-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s)
    }).catch(() => {})
  }

  function handleSaveEntry(dateStr, entry) {
    saveEntry(currentThursday, dateStr, entry)
    const updated = getPeriodEntries(currentThursday)
    setEntries(updated)
    setLogModal(null)
    syncToServer(currentThursday, updated)
  }

  function handleDeleteEntry(dateStr) {
    deleteEntry(currentThursday, dateStr)
    const updated = getPeriodEntries(currentThursday)
    setEntries(updated)
    syncToServer(currentThursday, updated)
  }

  function handleSaveSettings(newSettings) {
    saveSettings(newSettings)
    setSettings(newSettings)
    setShowSettings(false)
    syncSettingsToServer(newSettings)
  }

  async function handleSendEmail() {
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/send-timesheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodDates, entries, settings })
      })
      const data = await res.json()
      setSendResult(data.success ? 'sent' : 'error')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
    }
  }

  // totals
  let totalHrs = 0
  periodDates.forEach((d) => {
    totalHrs += calcEntryHours(entries[d])
  })
  const totalEarnings = (totalHrs * settings.rate).toFixed(2)

  // missing days banner
  const missingDays = isCurrentPeriod
    ? periodDates.filter((d) => {
        if (isWeekend(d)) return false
        if (!isPast(d) && d !== today) return false
        return !entries[d]?.start
      })
    : []

  function dismissInstall() {
    localStorage.setItem('icans_ts_install_dismissed', '1')
    setShowInstallBanner(false)
  }

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setShowInstallBanner(false)
    setInstallPrompt(null)
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="logo-mark">i</div>
          <div>
            <div className="brand-name">iCANS</div>
            <div className="brand-sub">Timesheet</div>
          </div>
        </div>
        <button className="settings-btn" onClick={() => setShowSettings(true)}>⚙</button>
      </header>

      <main className="app-main">
        {/* Missing days banner */}
        {missingDays.length > 0 && (
          <div className="missing-banner">
            <span>👋 Hey! Missing entries: </span>
            {missingDays.map((d, i) => (
              <span key={d}>
                <button className="missing-link" onClick={() => setLogModal(d)}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </button>
                {i < missingDays.length - 1 && ' · '}
              </span>
            ))}
          </div>
        )}

        {/* Period navigation */}
        <div className="period-nav">
          <button className="nav-arrow" onClick={() => setCurrentThursday(prevThursday(currentThursday))}>‹</button>
          <div className="period-center">
            <div className="period-range">{formatDisplayRange(currentThursday)}</div>
            {isCurrentPeriod
              ? <span className="period-badge current">Current Period</span>
              : <span className="period-badge past">{currentThursday.slice(0, 4)}</span>
            }
          </div>
          <button
            className="nav-arrow"
            onClick={() => setCurrentThursday(nextThursday(currentThursday))}
            disabled={currentThursday >= todayThursday}
          >›</button>
        </div>

        {/* Day rows */}
        <div className="day-list">
          {periodDates.map((dateStr) => (
            <DayRow
              key={dateStr}
              dateStr={dateStr}
              entry={entries[dateStr]}
              rate={settings.rate}
              onLog={handleLog}
              onEdit={handleLog}
              onDelete={handleDeleteEntry}
            />
          ))}
        </div>

        {/* Summary card */}
        <div className="summary-card">
          <div className="summary-label">Period Total</div>
          <div className="summary-nums">
            <span className="summary-hours">{formatHours(totalHrs)} hrs</span>
            <span className="summary-earnings">${totalEarnings}</span>
          </div>
          {sendResult === 'sent' && (
            <div className="send-success">✓ Timesheet sent to Katherine!</div>
          )}
          {sendResult === 'error' && (
            <div className="send-error">Failed to send. Check your connection and try again.</div>
          )}
          <div className="summary-actions">
            <button className="btn-ghost-white" onClick={() => setShowPDF(true)}>👁 Preview PDF</button>
            <button className="btn-green" onClick={handleSendEmail} disabled={sending}>
              {sending ? 'Sending…' : '📤 Submit & Email Katherine'}
            </button>
          </div>
        </div>
      </main>

      {/* Install banner */}
      {showInstallBanner && (
        <div className="install-banner">
          <span>📱 Add iCANS Timesheet to your home screen for the best experience</span>
          <button className="btn-install" onClick={handleInstall}>Add</button>
          <button className="btn-dismiss" onClick={dismissInstall}>✕</button>
        </div>
      )}

      {/* Modals */}
      {logModal && (
        <LogModal
          dateStr={logModal}
          existing={entries[logModal]}
          rate={settings.rate}
          logMode={settings.logMode || 'time'}
          onSave={(entry) => handleSaveEntry(logModal, entry)}
          onCancel={() => setLogModal(null)}
        />
      )}

      {showPDF && (
        <PDFPreview
          periodDates={periodDates}
          entries={entries}
          settings={settings}
          onClose={() => { setShowPDF(false); setSendResult(null) }}
          onSendEmail={handleSendEmail}
          sending={sending}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onCancel={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
