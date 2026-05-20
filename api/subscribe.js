import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const subscription = req.body
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' })

  try {
    // Use endpoint as key to avoid duplicates
    const key = 'push_sub:' + Buffer.from(subscription.endpoint).toString('base64').slice(0, 64)
    await kv.set(key, { subscription, savedAt: new Date().toISOString() })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    // Non-fatal — push is best-effort
    return res.status(200).json({ success: true, note: 'stored locally only' })
  }
}
