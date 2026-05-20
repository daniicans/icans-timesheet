export function getThursdayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun,1=Mon,...,4=Thu,5=Fri,6=Sat
  // days since last Thursday
  const diff = (day + 3) % 7 // Thu=0, Fri=1, Sat=2, Sun=3, Mon=4, Tue=5, Wed=6
  d.setDate(d.getDate() - diff)
  return toISO(d)
}

export function getPayPeriod(thursdayStr) {
  const start = new Date(thursdayStr + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return toISO(d)
  })
}

export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISO(new Date())
}

export function formatDisplayRange(thursdayStr) {
  const dates = getPayPeriod(thursdayStr)
  const start = parseDate(dates[0])
  const end = parseDate(dates[6])
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (start.getMonth() === end.getMonth()) {
    return `${months[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`
  }
  return `${months[start.getMonth()]} ${start.getDate()} – ${months[end.getMonth()]} ${end.getDate()}`
}

export function formatFullDate(dateStr) {
  const d = parseDate(dateStr)
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`
}

export function formatShortDate(dateStr) {
  const d = parseDate(dateStr)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[d.getMonth()]} ${d.getDate()}`
}

export function getDayLabel(dateStr) {
  const d = parseDate(dateStr)
  return ['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]
}

export function getDayNum(dateStr) {
  return parseDate(dateStr).getDate()
}

export function isWeekend(dateStr) {
  const day = parseDate(dateStr).getDay()
  return day === 0 || day === 6
}

export function isPast(dateStr) {
  return dateStr < todayISO()
}

export function isToday(dateStr) {
  return dateStr === todayISO()
}

export function isFuture(dateStr) {
  return dateStr > todayISO()
}

export function calcHours(start, end) {
  if (!start || !end) return 0
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const mins = (eh * 60 + em) - (sh * 60 + sm)
  return Math.max(0, mins / 60)
}

export function formatHours(h) {
  return h.toFixed(2)
}

export function formatTime12(time24) {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function prevThursday(thursdayStr) {
  const d = new Date(thursdayStr + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  return toISO(d)
}

export function nextThursday(thursdayStr) {
  const d = new Date(thursdayStr + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  return toISO(d)
}

function parseDate(str) {
  return new Date(str + 'T00:00:00')
}
