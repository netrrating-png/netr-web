import type { NextApiRequest, NextApiResponse } from 'next'

const ADMIN_PASSWORD = 'dimesandnickles4'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obroygzzfpphumsrqtsm.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, password } = req.body
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Court ID required' })
  if (!SERVICE_KEY) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })

  const response = await fetch(`${SUPABASE_URL}/rest/v1/courts?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ verified: true }),
  })

  if (!response.ok) {
    const err = await response.text()
    return res.status(response.status).json({ error: err })
  }

  const data = await response.json()
  if (!data.length) return res.status(404).json({ error: 'Court not found or already verified' })

  return res.status(200).json({ success: true, court: data[0] })
}
