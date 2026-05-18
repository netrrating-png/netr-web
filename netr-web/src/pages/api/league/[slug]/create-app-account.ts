import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Uses the service-role key so we can call auth.admin.createUser
// and write back the app_account_id to the leagues row.
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const anonClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { slug } = req.query as { slug: string }
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) return res.status(400).json({ error: 'email and password required' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  // Verify the requesting user owns this league
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

  const token = authHeader.replace('Bearer ', '')
  const { data: { user: owner } } = await anonClient.auth.getUser(token)
  if (!owner) return res.status(401).json({ error: 'Unauthorized' })

  const { data: league, error: leagueErr } = await adminClient
    .from('leagues')
    .select('id, name, slug, logo_url, sport, accent_color, app_account_id')
    .eq('slug', slug)
    .eq('owner_id', owner.id)
    .single()

  if (leagueErr || !league) return res.status(404).json({ error: 'League not found or not yours' })

  if (league.app_account_id) {
    return res.status(409).json({ error: 'This league already has an app account' })
  }

  // 1. Create the auth user for the league account
  const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,   // pre-confirm so they can sign in immediately
    user_metadata: {
      full_name: league.name,
      is_league_account: true,
      league_id: league.id,
    },
  })

  if (createErr || !newUser.user) {
    return res.status(400).json({ error: createErr?.message ?? 'Failed to create account' })
  }

  const leagueUserId = newUser.user.id

  // 2. Upsert the profiles row (the auto-create trigger may have fired already)
  const { error: profileErr } = await adminClient
    .from('profiles')
    .upsert({
      id:                 leagueUserId,
      full_name:          league.name,
      username:           `league_${league.slug}`,
      avatar_url:         league.logo_url ?? null,
      is_league_account:  true,
      league_id:          league.id,
    }, { onConflict: 'id' })

  if (profileErr) {
    // Rollback the auth user so we're not left in a half-created state
    await adminClient.auth.admin.deleteUser(leagueUserId)
    return res.status(500).json({ error: 'Failed to create profile: ' + profileErr.message })
  }

  // 3. Write app_account_id back to the league
  const { error: updateErr } = await adminClient
    .from('leagues')
    .update({ app_account_id: leagueUserId })
    .eq('id', league.id)

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to link account to league' })
  }

  return res.status(200).json({
    success: true,
    profile_id: leagueUserId,
    username: `league_${league.slug}`,
    message: 'League app account created. Use the email and password to sign in on the NETR app.',
  })
}
