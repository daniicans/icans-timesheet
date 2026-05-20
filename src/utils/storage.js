const TS_KEY = 'icans_ts_v1'
const SETTINGS_KEY = 'icans_ts_settings_v1'
const SUBS_KEY = 'icans_ts_push_sub'

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : defaultSettings()
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export function defaultSettings() {
  return { name: 'Dani', email: 'dani@icans.ai', rate: 25 }
}

export function getAllEntries() {
  try {
    const raw = localStorage.getItem(TS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function getPeriodEntries(thursdayStr) {
  const all = getAllEntries()
  return all[thursdayStr] || {}
}

export function saveEntry(thursdayStr, dateStr, entry) {
  const all = getAllEntries()
  if (!all[thursdayStr]) all[thursdayStr] = {}
  all[thursdayStr][dateStr] = entry
  localStorage.setItem(TS_KEY, JSON.stringify(all))
}

export function deleteEntry(thursdayStr, dateStr) {
  const all = getAllEntries()
  if (all[thursdayStr]) {
    delete all[thursdayStr][dateStr]
    localStorage.setItem(TS_KEY, JSON.stringify(all))
  }
}

export function getPushSub() {
  try {
    const raw = localStorage.getItem(SUBS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePushSub(sub) {
  localStorage.setItem(SUBS_KEY, JSON.stringify(sub))
}
