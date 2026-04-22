import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function icsDate(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z')
}

function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query as { slug: string }

  const { data: league } = await supabase
    .from('leagues')
    .select('id, name, location')
    .eq('slug', slug)
    .single()

  if (!league) return res.status(404).end('League not found')

  const { data: games } = await supabase
    .from('league_games')
    .select('id, scheduled_at, location, status, home_team_id, away_team_id')
    .eq('league_id', league.id)
    .in('status', ['scheduled', 'final'])
    .order('scheduled_at')

  const { data: teams } = await supabase
    .from('league_teams')
    .select('id, name')
    .eq('league_id', league.id)

  const teamMap: Record<string, string> = {}
  for (const t of teams ?? []) teamMap[t.id] = t.name

  const events = (games ?? []).map(g => {
    const start = icsDate(g.scheduled_at)
    // default game duration 2 hours
    const endMs = new Date(g.scheduled_at).getTime() + 2 * 60 * 60 * 1000
    const end = icsDate(new Date(endMs).toISOString())
    const home = teamMap[g.home_team_id] ?? 'Home'
    const away = teamMap[g.away_team_id] ?? 'Away'
    const loc = g.location ?? league.location ?? ''
    const summary = `${home} vs ${away}${g.status === 'final' ? ' (Final)' : ''}`
    return [
      'BEGIN:VEVENT',
      `UID:netr-game-${g.id}@netr.pro`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${icsEscape(summary)}`,
      loc ? `LOCATION:${icsEscape(loc)}` : null,
      `STATUS:${g.status === 'final' ? 'CONFIRMED' : 'TENTATIVE'}`,
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')
  })

  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NETR//League Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(league.name)}`,
    `X-WR-TIMEZONE:America/New_York`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${slug}.ics"`)
  res.setHeader('Cache-Control', 'public, s-maxage=300')
  res.status(200).send(cal)
}
