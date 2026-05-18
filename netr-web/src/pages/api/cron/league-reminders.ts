import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

// Vercel cron calls this daily at 10:00 UTC.
// Finds league games scheduled ~3 days from now and sends a reminder
// message into each team's crew chat + a push notification.
export const config = { maxDuration: 60 }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role: can write messages + read devices
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Allow Vercel cron (no Authorization header) OR internal calls with CRON_SECRET
  const authHeader = req.headers.authorization
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // ── Find games 66–78 hours away (the "3 day" window, checked daily) ──────
  const windowStart = new Date(Date.now() + 66 * 60 * 60 * 1000).toISOString()
  const windowEnd   = new Date(Date.now() + 78 * 60 * 60 * 1000).toISOString()

  const { data: games, error: gamesErr } = await supabase
    .from('league_games')
    .select(`
      id,
      scheduled_at,
      location,
      league_id,
      home_team_id,
      away_team_id,
      leagues ( id, name, accent_color, logo_url, app_account_id ),
      home_team:league_teams!home_team_id ( id, name, crew_id ),
      away_team:league_teams!away_team_id ( id, name, crew_id )
    `)
    .eq('status', 'scheduled')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (gamesErr) return res.status(500).json({ error: gamesErr.message })
  if (!games?.length) return res.status(200).json({ sent: 0, message: 'No games in window' })

  let sent = 0
  const errors: string[] = []

  for (const game of games as any[]) {
    const league = game.leagues
    if (!league) continue

    const teams = [
      { team: game.home_team, opponent: game.away_team },
      { team: game.away_team, opponent: game.home_team },
    ]

    for (const { team, opponent } of teams) {
      if (!team?.crew_id) continue

      // Skip if we already sent a reminder for this game+team
      const { data: alreadySent } = await supabase
        .from('league_game_reminders_sent')
        .select('id')
        .eq('league_game_id', game.id)
        .eq('team_id', team.id)
        .maybeSingle()

      if (alreadySent) continue

      // Build the reminder message content
      const gameDate  = new Date(game.scheduled_at)
      const dateStr   = gameDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'short', day: 'numeric',
      })
      const timeStr   = gameDate.toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
      })
      const content   = `🏀 Game Reminder: ${team.name} vs ${opponent?.name ?? 'TBD'} — ${dateStr} at ${timeStr}${game.location ? ` · ${game.location}` : ''}. RSVP below 👇`

      // Insert the reminder message into the team's crew
      const senderId = league.app_account_id   // the league's NETR profile
      if (!senderId) continue

      const { error: msgErr } = await supabase
        .from('crew_messages')
        .insert({
          crew_id:         team.crew_id,
          sender_id:       senderId,
          content,
          message_type:    'league_game_reminder',
          league_game_id:  game.id,
          league_id:       league.id,
          is_pinned:       false,
        })

      if (msgErr) {
        errors.push(`crew ${team.crew_id}: ${msgErr.message}`)
        continue
      }

      // Record that this reminder was sent
      await supabase
        .from('league_game_reminders_sent')
        .insert({ league_game_id: game.id, team_id: team.id, crew_id: team.crew_id })

      // ── Push notifications to all crew members ─────────────────────────
      const { data: members } = await supabase
        .from('crew_members')
        .select('user_id')
        .eq('crew_id', team.crew_id)

      if (members?.length) {
        const userIds = members.map((m: any) => m.user_id)

        // Fetch APNs tokens from the devices table
        const { data: devices } = await supabase
          .from('devices')
          .select('apns_token, environment')
          .in('user_id', userIds)
          .not('apns_token', 'is', null)

        if (devices?.length) {
          // Call the existing send-push Edge Function
          await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-push`,
            {
              method: 'POST',
              headers: {
                'Content-Type':  'application/json',
                Authorization:   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
              },
              body: JSON.stringify({
                tokens: devices.map((d: any) => ({
                  token:       d.apns_token,
                  environment: d.environment ?? 'production',
                })),
                title: `${league.name} · Game in 3 Days`,
                body:  `${team.name} vs ${opponent?.name ?? 'TBD'} · ${dateStr}`,
                data: {
                  type:          'league_game_reminder',
                  crew_id:       team.crew_id,
                  league_game_id: game.id,
                },
              }),
            }
          ).catch(() => {/* push failure is non-fatal */})
        }
      }

      sent++
    }
  }

  return res.status(200).json({ sent, errors: errors.length ? errors : undefined })
}
