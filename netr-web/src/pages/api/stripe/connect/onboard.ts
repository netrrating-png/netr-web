import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(supabaseUrl, serviceRoleKey)

  // Verify the authenticated user owns this league
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { leagueId } = req.body as { leagueId?: string }
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  const { data: league, error } = await admin
    .from('leagues')
    .select('id, name, stripe_account_id, stripe_onboarding_complete')
    .eq('id', leagueId)
    .eq('owner_id', user.id)
    .single()

  if (error || !league) return res.status(404).json({ error: 'League not found' })

  let accountId = league.stripe_account_id as string | null

  try {
    // Create a new Express account if none exists
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          name: league.name as string,
          product_description: 'Sports league fee collection',
          mcc: '7941',
        },
      })
      accountId = account.id
      await admin
        .from('leagues')
        .update({ stripe_account_id: accountId, stripe_onboarding_complete: false })
        .eq('id', leagueId)
    }

    const proto = req.headers['x-forwarded-proto'] ?? 'https'
    const host = req.headers['x-forwarded-host'] ?? req.headers.host
    const base = `${proto}://${host}`

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}/league-portal/${leagueId}/budget`,
      return_url: `${base}/league-portal/${leagueId}/budget?stripe_return=1`,
      type: 'account_onboarding',
    })

    return res.status(200).json({ url: accountLink.url })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[stripe/connect/onboard]', msg)
    return res.status(500).json({ error: msg })
  }
}
