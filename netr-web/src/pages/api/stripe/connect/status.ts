import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../../../lib/stripe'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { leagueId } = req.query as { leagueId?: string }
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  const { data: league } = await admin
    .from('leagues')
    .select('stripe_account_id, stripe_onboarding_complete')
    .eq('id', leagueId)
    .eq('owner_id', user.id)
    .single()

  if (!league?.stripe_account_id) {
    return res.status(200).json({ connected: false, chargesEnabled: false })
  }

  const account = await stripe.accounts.retrieve(league.stripe_account_id)
  const complete = account.charges_enabled && account.payouts_enabled

  // Sync the DB if onboarding just finished
  if (complete && !league.stripe_onboarding_complete) {
    await admin
      .from('leagues')
      .update({ stripe_onboarding_complete: true })
      .eq('id', leagueId)
  }

  return res.status(200).json({
    connected: true,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    complete,
  })
}
