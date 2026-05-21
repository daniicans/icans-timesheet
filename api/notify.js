import webpush from 'web-push'
import { kv } from '@vercel/kv'

webpush.setVapidDetails(
  'mailto:dani@icans.ai',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

async function sendPushToAll(title, body) {
  const keys = await kv.keys('push_sub:*')
  if (!keys.length) return { sent: 0, failed: 0 }

  const payload = JSON.stringify({ title, body })
  let sent = 0, failed = 0

  await Promise.allSettled(
    keys.map(async (key) => {
      const record = await kv.get(key)
      if (!record?.subscription) return
      try {
        await webpush.sendNotification(record.subscription, payload)
        sent++
      } catch (err) {
        failed++
        if (err.statusCode === 410 || err.statusCode === 404) await kv.del(key)
      }
    })
  )
  return { sent, failed }
}

function getThursdayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay()
  const diff = (day + 3) % 7
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function getPayPeriod(thursdayStr) {
  const start = new Date(thursdayStr + 'T00:00:00Z')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

// Returns today's date in CST/CDT (UTC-6 / UTC-5)
function todayCST() {
  const now = new Date()
  // CDT = UTC-5 (Mar-Nov), CST = UTC-6 (Nov-Mar)
  // Use a fixed -6 offset to stay consistent with payroll expectations
  const cstOffset = -6 * 60
  const localMs = now.getTime() + cstOffset * 60000
  const d = new Date(localMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Unauthorized' })

  const today = todayCST()
  const thursdayStr = getThursdayOf(today)
  const periodDates = getPayPeriod(thursdayStr)
  const todayDow = new Date(today + 'T12:00:00Z').getUTCDay() // 0=Sun,4=Thu

  const results = {}

  // ── Thursday: auto-send timesheet ──────────────────────────────────────────
  if (todayDow === 4) {
    try {
      const record = await kv.get(`entries:${thursdayStr}`)
      const entries = record?.entries || {}
      const settings = await kv.get('settings') || { name: 'Dani', email: 'dani@icans.ai', rate: 25 }

      // Import and call send-timesheet logic
      const { default: sendHandler } = await import('./send-timesheet.js')

      // Build a mock req/res to reuse the handler
      let sendResult = null
      await new Promise((resolve) => {
        const mockReq = {
          method: 'POST',
          body: { periodDates, entries, settings }
        }
        const mockRes = {
          status: (code) => ({ json: (d) => { sendResult = { code, ...d }; resolve() } }),
          json: (d) => { sendResult = { code: 200, ...d }; resolve() }
        }
        sendHandler(mockReq, mockRes)
      })

      results.emailSent = sendResult?.success || false
      results.emailError = sendResult?.error

      // Push notification to confirm send
      if (sendResult?.success) {
        await sendPushToAll(
          '📬 Timesheet Sent!',
          `Your timesheet for this week was automatically emailed to Katherine.`
        )
        results.pushSent = true
      } else {
        // Email failed — nudge Dani to send manually
        await sendPushToAll(
          '⚠️ Timesheet Not Sent',
          'Auto-send failed. Open the app to submit your timesheet manually.'
        )
        results.pushSent = true
      }
    } catch (err) {
      console.error('Thursday auto-send error:', err)
      results.emailError = err.message
      // Still nudge manually
      await sendPushToAll('⏰ Timesheet Due', 'Time to submit your timesheet for this week!')
    }
  }

  // ── Mon–Fri: missing-time reminder ─────────────────────────────────────────
  if (todayDow >= 1 && todayDow <= 5) {
    try {
      const record = await kv.get(`entries:${thursdayStr}`)
      const entries = record?.entries || {}
      const todayEntry = entries[today]

      if (!todayEntry?.start || !todayEntry?.end) {
        const dayName = new Date(today + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
        const push = await sendPushToAll(
          '⏱ Missing Time Entry',
          `You haven't logged your hours for ${dayName} yet. Tap to open the app.`
        )
        results.missingReminder = push
      } else {
        results.missingReminder = 'already_logged'
      }
    } catch (err) {
      console.error('Missing-time reminder error:', err)
      results.reminderError = err.message
    }
  }

  return res.status(200).json({ success: true, today, dayOfWeek: todayDow, ...results })
}
