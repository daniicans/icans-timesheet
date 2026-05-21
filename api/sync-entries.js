import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { thursdayStr, entries } = req.body
  if (!thursdayStr || !entries) return res.status(400).json({ error: 'Missing fields' })

  try {
    await kv.set(`entries:${thursdayStr}`, { entries, updatedAt: new Date().toISOString() })
    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('sync-entries error:', err)
    return res.status(500).json({ error: err.message })
  }
}
