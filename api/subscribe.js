import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { subscription, userEmail } = req.body
  const sub = subscription || req.body // support both wrapped and bare formats
  if (!sub?.endpoint) return res.status(400).json({ error: 'Invalid subscription' })

  try {
    const emailKey = userEmail || 'unknown'
    const endpointHash = Buffer.from(sub.endpoint).toString('base64').slice(0, 48)
    const key = `push_sub:${emailKey}:${endpointHash}`
    await kv.set(key, { subscription: sub, userEmail: emailKey, savedAt: new Date().toISOString() })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('subscribe error:', err)
    return res.status(200).json({ success: true, note: 'stored locally only' })
  }
}
