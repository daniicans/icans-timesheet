import webpush from 'web-push'
import { kv } from '@vercel/kv'

webpush.setVapidDetails(
  'mailto:dani@icans.ai',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  // Secure cron endpoint
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Fetch all stored subscriptions from KV
    const keys = await kv.keys('push_sub:*')
    const results = { sent: 0, failed: 0 }

    const payload = JSON.stringify({
      title: '⏰ Timesheet Due',
      body: 'Time to submit your timesheet for this week!'
    })

    await Promise.allSettled(
      keys.map(async (key) => {
        const record = await kv.get(key)
        if (!record?.subscription) return
        try {
          await webpush.sendNotification(record.subscription, payload)
          results.sent++
        } catch (err) {
          results.failed++
          // Remove stale subscriptions (gone/expired)
          if (err.statusCode === 410 || err.statusCode === 404) {
            await kv.del(key)
          }
        }
      })
    )

    return res.status(200).json({ success: true, ...results })
  } catch (err) {
    console.error('notify error:', err)
    return res.status(500).json({ error: err.message })
  }
}
