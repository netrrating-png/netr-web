import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

// Number of Monte Carlo simulation iterations — 500 is accurate enough for rec leagues
const SIMULATIONS = 500

// ─── Data types ──────────────────────────────────────────────────────────────

type RawTeam   = { id: string; name: string; color: string; logo_url: string | null }
type RawGame   = { id: string; home_team_id: string; away_team_id: string; home_score: number | null; away_score: number | null; status: string; scheduled_at: string }
type RawPlayer = { id: string; team_id: string; netr_score: number | null }
type RawStanding = { team_id: string; wins: number; losses: number; pts_for: number; pts_against: number }
type RawInsight = { team_id: string; playoff_probability: number }

type TeamData = {
  team_id: string
  team_name: string
  color: string
  logo_url: string | null
  wins: number
  losses: number
  pts_for: number
  pts_against: number
  avg_netr: number       // average NETR score of players on this team
  recent_form: number    // weighted win rate from last 5 games (0–1)
  games_remaining: number
  remaining_opponents: string[]
}

export type InsightResult = {
  team_id: string
  team_name: string
  playoff_probability: number       // 0–1
  championship_probability: number  // 0–1
  magic_number: number | null       // null = mathematically eliminated
  trend: 'UP' | 'DOWN' | 'STABLE'
  insight_text: string
  games_played: number
  low_confidence: boolean
  wins: number
  losses: number
  color: string
  logo_url: string | null
  avg_netr: number
  recent_form: number
}

// ─── Step 1: Fetch all league data ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchLeagueData(supabase: any, leagueId: string) {
  const [teamsRes, gamesRes, playersRes, standingsRes, oldInsightsRes, leagueRes] = await Promise.all([
    supabase.from('league_teams').select('id,name,color,logo_url').eq('league_id', leagueId),
    supabase.from('league_games').select('id,home_team_id,away_team_id,home_score,away_score,status,scheduled_at').eq('league_id', leagueId).order('scheduled_at'),
    supabase.from('league_players').select('id,team_id,netr_score').eq('league_id', leagueId),
    supabase.from('league_standings').select('team_id,wins,losses,pts_for,pts_against').eq('league_id', leagueId),
    supabase.from('league_ai_insights').select('team_id,playoff_probability').eq('league_id', leagueId),
    supabase.from('leagues').select('id,playoff_spots').eq('id', leagueId).single(),
  ])

  return {
    teams:       (teamsRes.data     ?? []) as RawTeam[],
    games:       (gamesRes.data     ?? []) as RawGame[],
    players:     (playersRes.data   ?? []) as RawPlayer[],
    standings:   (standingsRes.data ?? []) as RawStanding[],
    oldInsights: (oldInsightsRes.data ?? []) as RawInsight[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    playoffSpots: (leagueRes.data as any)?.playoff_spots ?? 4,
  }
}

// ─── Step 2: Build enriched per-team data ────────────────────────────────────

function buildTeamData(
  teams: RawTeam[],
  games: RawGame[],
  players: RawPlayer[],
  standings: RawStanding[]
): TeamData[] {
  const standingMap = Object.fromEntries(standings.map(s => [s.team_id, s]))

  // Average NETR score per team
  const teamNetr: Record<string, number[]> = {}
  for (const p of players) {
    if (p.netr_score != null) {
      if (!teamNetr[p.team_id]) teamNetr[p.team_id] = []
      teamNetr[p.team_id].push(p.netr_score)
    }
  }

  const remaining = games.filter(g => g.status === 'scheduled')

  return teams.map(t => {
    const s = standingMap[t.id] ?? { wins: 0, losses: 0, pts_for: 0, pts_against: 0 }

    // Avg NETR — default 5.0 (midpoint of 2–9.9 scale) if no data
    const scores = teamNetr[t.id] ?? []
    const avg_netr = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 5.0

    // Recent form: weighted win rate over last 5 final games
    const finalGames = games
      .filter(g => (g.home_team_id === t.id || g.away_team_id === t.id) && g.status === 'final')
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
      .slice(0, 5)

    let weightedWins = 0, totalWeight = 0
    finalGames.forEach((g, i) => {
      const w = 5 - i // most recent = weight 5
      const isHome = g.home_team_id === t.id
      const myScore    = (isHome ? g.home_score : g.away_score) ?? 0
      const theirScore = (isHome ? g.away_score : g.home_score) ?? 0
      weightedWins += myScore > theirScore ? w : 0
      totalWeight  += w
    })
    const recent_form = totalWeight > 0 ? weightedWins / totalWeight : 0.5

    const teamRemaining = remaining.filter(g => g.home_team_id === t.id || g.away_team_id === t.id)
    const remaining_opponents = teamRemaining.map(g => g.home_team_id === t.id ? g.away_team_id : g.home_team_id)

    return {
      team_id: t.id, team_name: t.name, color: t.color, logo_url: t.logo_url,
      wins: s.wins, losses: s.losses, pts_for: s.pts_for, pts_against: s.pts_against,
      avg_netr, recent_form,
      games_remaining: teamRemaining.length,
      remaining_opponents,
    }
  })
}

// ─── Step 3: Monte Carlo simulation ──────────────────────────────────────────

function computeStrength(t: TeamData, all: TeamData[]): number {
  const gp = t.wins + t.losses
  const win_pct = gp > 0 ? t.wins / gp : 0.5

  // Normalize point differential across the league
  const diffs = all.map(x => x.pts_for - x.pts_against)
  const minD = Math.min(...diffs), maxD = Math.max(...diffs)
  const myDiff = t.pts_for - t.pts_against
  const norm_diff = maxD > minD ? (myDiff - minD) / (maxD - minD) : 0.5

  // Normalize NETR (range 2.0–9.9 → 0–1)
  const norm_netr = Math.min(1, Math.max(0, (t.avg_netr - 2) / 7.9))

  // Weighted composite: W/L % most important, then pt diff, NETR, recent form
  return 0.40 * win_pct + 0.30 * norm_diff + 0.20 * norm_netr + 0.10 * t.recent_form
}

function runMonteCarlo(
  teams: TeamData[],
  remaining: RawGame[],
  playoffSpots: number
): { playoffProb: Record<string, number>; champProb: Record<string, number> } {
  const playoffCount: Record<string, number> = {}
  const champCount:   Record<string, number> = {}
  for (const t of teams) { playoffCount[t.team_id] = 0; champCount[t.team_id] = 0 }

  const strengths = Object.fromEntries(teams.map(t => [t.team_id, computeStrength(t, teams)]))

  for (let sim = 0; sim < SIMULATIONS; sim++) {
    const wins:   Record<string, number> = Object.fromEntries(teams.map(t => [t.team_id, t.wins]))
    const losses: Record<string, number> = Object.fromEntries(teams.map(t => [t.team_id, t.losses]))

    // Simulate each remaining game
    for (const g of remaining) {
      const hs = strengths[g.home_team_id] ?? 0.5
      const as_ = strengths[g.away_team_id] ?? 0.5
      const total = hs + as_
      // Small home-court advantage bump
      const homeWinP = Math.min(0.85, (total > 0 ? hs / total : 0.5) + 0.04)

      if (Math.random() < homeWinP) {
        wins[g.home_team_id]   = (wins[g.home_team_id]   ?? 0) + 1
        losses[g.away_team_id] = (losses[g.away_team_id] ?? 0) + 1
      } else {
        wins[g.away_team_id]   = (wins[g.away_team_id]   ?? 0) + 1
        losses[g.home_team_id] = (losses[g.home_team_id] ?? 0) + 1
      }
    }

    // Final standings: sort by wins, break ties by strength
    const sorted = teams
      .map(t => ({ id: t.team_id, w: wins[t.team_id] ?? 0, s: strengths[t.team_id] ?? 0 }))
      .sort((a, b) => b.w - a.w || b.s - a.s)

    // Playoff qualifiers
    const spots = Math.min(playoffSpots, sorted.length)
    for (let i = 0; i < spots; i++) {
      playoffCount[sorted[i].id] = (playoffCount[sorted[i].id] ?? 0) + 1
    }

    // Championship: weighted random draw among playoff teams based on strength
    const bracket = sorted.slice(0, spots)
    const totalStr = bracket.reduce((sum, t) => sum + (strengths[t.id] ?? 0.1), 0)
    let rand = Math.random() * totalStr
    let champId = bracket[0].id
    for (const t of bracket) {
      rand -= strengths[t.id] ?? 0.1
      if (rand <= 0) { champId = t.id; break }
    }
    champCount[champId] = (champCount[champId] ?? 0) + 1
  }

  const playoffProb = Object.fromEntries(teams.map(t => [t.team_id, (playoffCount[t.team_id] ?? 0) / SIMULATIONS]))
  const champProb   = Object.fromEntries(teams.map(t => [t.team_id, (champCount[t.team_id]   ?? 0) / SIMULATIONS]))
  return { playoffProb, champProb }
}

// ─── Step 4: Magic numbers ────────────────────────────────────────────────────

function calculateMagicNumbers(teams: TeamData[], playoffSpots: number): Record<string, number | null> {
  const sorted = [...teams].sort((a, b) =>
    b.wins - a.wins || (b.pts_for - b.pts_against) - (a.pts_for - a.pts_against)
  )
  const result: Record<string, number | null> = {}

  const firstOut = sorted[playoffSpots] // team just outside playoffs (may be undefined)

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i]

    if (i < playoffSpots) {
      // In playoff position — magic number is wins needed to clinch vs first team out
      if (!firstOut) {
        result[t.team_id] = 0 // all teams make playoffs, already clinched
      } else {
        const mn = firstOut.wins + firstOut.games_remaining - t.wins + 1
        result[t.team_id] = Math.max(0, mn)
      }
    } else {
      // Outside playoffs — check if still mathematically alive
      const target = sorted[playoffSpots - 1]
      const maxPossibleWins = t.wins + t.games_remaining
      if (maxPossibleWins < target.wins) {
        result[t.team_id] = null // eliminated
      } else {
        const mn = target.wins + target.games_remaining - t.wins + 1
        result[t.team_id] = Math.max(1, mn)
      }
    }
  }

  return result
}

// ─── Step 5: Trend detection ──────────────────────────────────────────────────

function getTrend(teamId: string, newProb: number, old: RawInsight[]): 'UP' | 'DOWN' | 'STABLE' {
  const prev = old.find(o => o.team_id === teamId)
  if (!prev) return 'STABLE'
  const delta = newProb - prev.playoff_probability
  if (delta > 0.04) return 'UP'
  if (delta < -0.04) return 'DOWN'
  return 'STABLE'
}

// ─── Step 6: Claude API — generate plain-English insights ────────────────────

async function generateInsightTexts(
  teams: TeamData[],
  playoffProb: Record<string, number>,
  champProb: Record<string, number>,
  magicNumbers: Record<string, number | null>,
  trends: Record<string, 'UP' | 'DOWN' | 'STABLE'>,
  playoffSpots: number,
  lowConfidence: boolean
): Promise<Record<string, string>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const sorted = [...teams].sort((a, b) => b.wins - a.wins)

  const teamInputs = sorted.map(t => {
    const mn = magicNumbers[t.team_id]
    return {
      team:               t.team_name,
      record:             `${t.wins}-${t.losses}`,
      point_diff:         t.pts_for - t.pts_against > 0 ? `+${t.pts_for - t.pts_against}` : String(t.pts_for - t.pts_against),
      recent_form:        `${Math.round(t.recent_form * 100)}% win rate (last 5 games)`,
      avg_roster_netr:    t.avg_netr.toFixed(1),
      games_remaining:    t.games_remaining,
      playoff_spots_total: playoffSpots,
      playoff_probability: `${Math.round(playoffProb[t.team_id] * 100)}%`,
      championship_probability: `${Math.round(champProb[t.team_id] * 100)}%`,
      status:             mn === null ? 'mathematically eliminated' : mn === 0 ? 'clinched playoff spot' : `magic number: ${mn}`,
      trend:              trends[t.team_id],
    }
  })

  const confidenceWarning = lowConfidence
    ? ' IMPORTANT: Fewer than 4 games have been played. Flag every insight as early-season, low-confidence. Use language like "too early to tell" or "small sample size."'
    : ''

  const systemPrompt = `You are a sharp basketball analyst writing team insights for NETR, a peer-rated recreational league app. Your writing is direct, confident, and specific — you sound like a knowledgeable friend watching the games, not a generic AI.${confidenceWarning}`

  const userPrompt = `Write a 2–3 sentence plain-English insight for each team below. Rules:
- Reference their actual numbers naturally (don't say "you have X%", say "their 73% playoff odds")
- Vary tone by situation: high probability = confident/exciting, low = honest/measured, eliminated = acknowledge it then pivot to pride/stats
- Teams that have clinched their spot: shift focus entirely to championship contention
- Do NOT use lists, headers, or bullet points — pure prose only
- Sound specific, not generic ("three of their next four games are against losing teams" not "keep playing hard")
- Return ONLY valid JSON: {"Team Name": "2-3 sentence insight", ...}

Teams to analyze:
${JSON.stringify(teamInputs, null, 2)}`

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1200,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const block = msg.content[0]
  if (block.type !== 'text') return {}

  const match = block.text.match(/\{[\s\S]*\}/)
  if (!match) return {}

  try {
    return JSON.parse(match[0]) as Record<string, string>
  } catch {
    return {}
  }
}

// ─── Step 7: Main orchestrator ────────────────────────────────────────────────

export async function generateLeagueInsights(leagueId: string): Promise<InsightResult[]> {
  // Server-side only — uses service role key if available to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { teams, games, players, standings, oldInsights, playoffSpots } = await fetchLeagueData(supabase, leagueId)

  if (teams.length === 0) return []

  const completed = games.filter(g => g.status === 'final')
  const remaining = games.filter(g => g.status === 'scheduled')
  const lowConfidence = completed.length < 4

  const teamData     = buildTeamData(teams, games, players, standings)
  const { playoffProb, champProb } = runMonteCarlo(teamData, remaining, playoffSpots)
  const magicNumbers = calculateMagicNumbers(teamData, playoffSpots)

  const trends: Record<string, 'UP' | 'DOWN' | 'STABLE'> = {}
  for (const t of teamData) {
    trends[t.team_id] = getTrend(t.team_id, playoffProb[t.team_id] ?? 0, oldInsights)
  }

  const insightTexts = await generateInsightTexts(teamData, playoffProb, champProb, magicNumbers, trends, playoffSpots, lowConfidence)

  const now     = new Date().toISOString()
  const results = teamData.map(t => ({
    team_id:                  t.team_id,
    team_name:                t.team_name,
    playoff_probability:      playoffProb[t.team_id]  ?? 0,
    championship_probability: champProb[t.team_id]    ?? 0,
    magic_number:             magicNumbers[t.team_id]  ?? null,
    trend:                    trends[t.team_id]        ?? 'STABLE' as const,
    insight_text:             insightTexts[t.team_name] ?? 'Analysis in progress.',
    games_played:             t.wins + t.losses,
    low_confidence:           lowConfidence,
    wins:                     t.wins,
    losses:                   t.losses,
    color:                    t.color,
    logo_url:                 t.logo_url,
    avg_netr:                 t.avg_netr,
    recent_form:              t.recent_form,
  }))

  // Upsert all results in one batch
  await supabase.from('league_ai_insights').upsert(
    results.map(r => ({
      league_id:                leagueId,
      team_id:                  r.team_id,
      playoff_probability:      r.playoff_probability,
      championship_probability: r.championship_probability,
      magic_number:             r.magic_number,
      trend:                    r.trend,
      insight_text:             r.insight_text,
      games_played:             r.games_played,
      low_confidence:           r.low_confidence,
      generated_at:             now,
    })),
    { onConflict: 'league_id,team_id' }
  )

  return results.sort((a, b) => b.wins - a.wins || b.playoff_probability - a.playoff_probability)
}

// ─── Fetch cached insights (used by GET endpoint) ─────────────────────────────

export async function fetchCachedInsights(leagueId: string): Promise<InsightResult[] | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [insightsRes, teamsRes] = await Promise.all([
    supabase.from('league_ai_insights').select('*').eq('league_id', leagueId).order('playoff_probability', { ascending: false }),
    supabase.from('league_teams').select('id,name,color,logo_url').eq('league_id', leagueId),
  ])

  const insights = insightsRes.data ?? []
  const teamMap  = Object.fromEntries((teamsRes.data ?? []).map(t => [t.id, t]))

  if (insights.length === 0) return null

  return insights.map(i => {
    const team = teamMap[i.team_id] ?? {}
    return {
      team_id:                  i.team_id,
      team_name:                (team as RawTeam).name ?? '',
      playoff_probability:      i.playoff_probability,
      championship_probability: i.championship_probability,
      magic_number:             i.magic_number,
      trend:                    i.trend as 'UP' | 'DOWN' | 'STABLE',
      insight_text:             i.insight_text,
      games_played:             i.games_played,
      low_confidence:           i.low_confidence,
      wins:                     0,
      losses:                   0,
      color:                    (team as RawTeam).color ?? '#39FF14',
      logo_url:                 (team as RawTeam).logo_url ?? null,
      avg_netr:                 0,
      recent_form:              0,
    }
  })
}
