import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { name, email, rate, katherineEmail } = req.body
  if (!name || !rate) return res.status(400).json({ error: 'Missing fields' })

  try {
    await kv.set('settings', { name, email, rate, katherineEmail })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('sync-settings error:', err)
    return res.status(500).json({ error: err.message })
  }
}
