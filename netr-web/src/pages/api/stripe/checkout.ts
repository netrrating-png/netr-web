import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../../lib/stripe'

type Body = {
  leagueId: string
  teamId: string
  mode: 'full' | 'split' | 'plan'
  // split mode
  playerName?: string
  playerEmail?: string
  // plan mode is configured on the league
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { leagueId, teamId, mode, playerName, playerEmail } = req.body as Body

  if (!leagueId || !teamId || !mode) {
    return res.status(400).json({ error: 'leagueId, teamId, and mode are required' })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const [{ data: league }, { data: team }, { count: rosterSize }] = await Promise.all([
    admin.from('leagues')
      .select('id, name, fee_amount, stripe_account_id, stripe_onboarding_complete, installment_count, installment_interval')
      .eq('id', leagueId)
      .single(),
    admin.from('league_teams')
      .select('id, name, fee_paid')
      .eq('id', teamId)
      .eq('league_id', leagueId)
      .single(),
    admin.from('league_players')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId),
  ])

  if (!league || !team) return res.status(404).json({ error: 'League or team not found' })
  if (!league.stripe_account_id || !league.stripe_onboarding_complete) {
    return res.status(400).json({ error: 'League has not connected a Stripe account yet' })
  }
  if (!league.fee_amount) return res.status(400).json({ error: 'League has no fee amount set' })
  if (team.fee_paid && mode !== 'split') {
    return res.status(400).json({ error: 'This team has already paid' })
  }

  const proto = req.headers['x-forwarded-proto'] ?? 'https'
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const base = `${proto}://${host}`
  const payBase = `${base}/pay/${leagueId}/${teamId}`

  const connectedAccount = league.stripe_account_id as string
  const feeCents = Math.round((league.fee_amount as number) * 100)

  if (mode === 'full') {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: feeCents,
          product_data: {
            name: `${league.name} — League Fee`,
            description: `Team: ${team.name}`,
          },
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: connectedAccount },
      },
      metadata: { leagueId, teamId, mode: 'full' },
      success_url: `${payBase}?success=1`,
      cancel_url: `${payBase}?cancelled=1`,
    })
    return res.status(200).json({ url: session.url })
  }

  if (mode === 'split') {
    if (!playerName?.trim()) {
      return res.status(400).json({ error: 'playerName is required for split payments' })
    }
    const players = rosterSize ?? 1
    const shareAmount = Math.round(feeCents / players)

    // Pre-create the player payment record so the webhook can reference it
    const { data: playerPayment } = await admin
      .from('league_player_payments')
      .insert({
        team_id: teamId,
        league_id: leagueId,
        player_name: playerName.trim(),
        player_email: playerEmail?.trim() ?? null,
        amount_cents: shareAmount,
      })
      .select('id')
      .single()

    if (!playerPayment) return res.status(500).json({ error: 'Failed to create payment record' })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: shareAmount,
          product_data: {
            name: `${league.name} — Player Share`,
            description: `${team.name} · ${players} players · your share of $${league.fee_amount}`,
          },
        },
        quantity: 1,
      }],
      customer_email: playerEmail?.trim() || undefined,
      payment_intent_data: {
        application_fee_amount: 0,
        transfer_data: { destination: connectedAccount },
      },
      metadata: { leagueId, teamId, mode: 'split', playerPaymentId: playerPayment.id, totalPlayers: String(players) },
      success_url: `${payBase}?success=1&player=1`,
      cancel_url: `${payBase}?cancelled=1`,
    })

    // Store the session ID on the payment record
    await admin
      .from('league_player_payments')
      .update({ stripe_session_id: session.id })
      .eq('id', playerPayment.id)

    return res.status(200).json({ url: session.url })
  }

  if (mode === 'plan') {
    const installments = (league.installment_count as number) ?? 3
    const interval = (league.installment_interval as string) ?? 'month'
    const installmentCents = Math.round(feeCents / installments)

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: installmentCents,
          recurring: { interval: interval as 'month' | 'week' },
          product_data: {
            name: `${league.name} — Payment Plan`,
            description: `${team.name} · ${installments} payments of $${(installmentCents / 100).toFixed(2)}`,
          },
        },
        quantity: 1,
      }],
      subscription_data: {
        application_fee_percent: 0,
        transfer_data: { destination: connectedAccount },
        metadata: { leagueId, teamId, mode: 'plan', installmentTotal: String(installments) },
      },
      metadata: { leagueId, teamId, mode: 'plan' },
      success_url: `${payBase}?success=1&plan=1`,
      cancel_url: `${payBase}?cancelled=1`,
    })
    return res.status(200).json({ url: session.url })
  }

  return res.status(400).json({ error: 'Invalid mode' })
}
