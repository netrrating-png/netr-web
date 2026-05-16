import type { NextApiRequest, NextApiResponse } from 'next'

const ADMIN_PASSWORD = 'dimesandnickles4'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obroygzzfpphumsrqtsm.supabase.co'
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, password } = req.body
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Court ID required' })

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/approve_court`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ court_id: id, admin_pass: ADMIN_PASSWORD }),
  })

  if (!response.ok) {
    const err = await response.text()
    return res.status(response.status).json({ error: err })
  }

  return res.status(200).json({ success: true })
}
