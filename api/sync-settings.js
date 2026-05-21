import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, rate, katherineEmail, logMode } = req.body
  if (!name || !email || !rate) return res.status(400).json({ error: 'Missing fields' })

  try {
    // Save this user's settings
    await kv.set(`settings:${email}`, {
      name, email, rate: Number(rate),
      katherineEmail: katherineEmail || 'katherine@icans.ai',
      logMode: logMode || 'time'
    })
    // Register user in the global user list (used by cron to find all users)
    await kv.sadd('users', email)
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('sync-settings error:', err)
    return res.status(500).json({ error: err.message })
  }
}
