import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { stripe } from '../../../lib/stripe'
import type Stripe from 'stripe'

// Stripe requires the raw body to verify the webhook signature
export const config = { api: { bodyParser: false } }

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const sig = req.headers['stripe-signature']
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature' })

  const rawBody = await readRawBody(req)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { leagueId, teamId, mode, playerPaymentId, totalPlayers } = session.metadata ?? {}
    if (!leagueId || !teamId) return res.status(200).json({ received: true })

    if (mode === 'full') {
      await admin
        .from('league_teams')
        .update({ fee_paid: true, payment_mode: 'full' })
        .eq('id', teamId)
    }

    if (mode === 'split' && playerPaymentId) {
      await admin
        .from('league_player_payments')
        .update({ paid_at: new Date().toISOString() })
        .eq('id', playerPaymentId)

      // Check if all player slots are paid
      const { count: paidCount } = await admin
        .from('league_player_payments')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId)
        .not('paid_at', 'is', null)

      const total = parseInt(totalPlayers ?? '0', 10)
      if (total > 0 && (paidCount ?? 0) >= total) {
        await admin
          .from('league_teams')
          .update({ fee_paid: true, payment_mode: 'split' })
          .eq('id', teamId)
      }
    }

    if (mode === 'plan') {
      // First installment paid — store the subscription ID
      const subscriptionId = session.subscription as string | null
      await admin
        .from('league_teams')
        .update({
          payment_mode: 'plan',
          stripe_subscription_id: subscriptionId,
          installments_paid: 1,
          installments_total: parseInt(session.metadata?.installmentTotal ?? '3', 10),
        })
        .eq('id', teamId)
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    const subId = (invoice as { subscription?: string }).subscription
    if (!subId) return res.status(200).json({ received: true })

    const { data: team } = await admin
      .from('league_teams')
      .select('id, installments_paid, installments_total, stripe_subscription_id')
      .eq('stripe_subscription_id', subId)
      .single()

    if (!team) return res.status(200).json({ received: true })

    // invoice.payment_succeeded fires for the first payment too (covered above), so only
    // increment after the first
    const newPaid = (team.installments_paid ?? 1) + 1
    const total = team.installments_total ?? 3

    if (newPaid >= total) {
      // All installments paid — mark team as fully paid and cancel the subscription
      await Promise.all([
        admin.from('league_teams').update({ fee_paid: true, installments_paid: total }).eq('id', team.id),
        stripe.subscriptions.cancel(subId),
      ])
    } else {
      await admin
        .from('league_teams')
        .update({ installments_paid: newPaid })
        .eq('id', team.id)
    }
  }

  return res.status(200).json({ received: true })
}
