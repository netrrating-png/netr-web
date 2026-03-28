import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.body
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' })
  }

  const apiKey = process.env.BEEHIIV_API_KEY
  const pubId = process.env.BEEHIIV_PUB_ID

  if (!apiKey || !pubId) {
    return res.status(500).json({ error: 'Server misconfiguration' })
  }

  try {
    const response = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email,
        reactivate_existing: false,
        send_welcome_email: true,
        utm_source: 'website',
        utm_medium: 'waitlist',
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('Beehiiv error:', err)
      return res.status(response.status).json({ error: 'Failed to subscribe' })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Waitlist error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
