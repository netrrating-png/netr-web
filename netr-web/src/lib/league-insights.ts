import { createClient } from '@supabase/supabase-js'

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

// ─── Step 6: Template-based insight generation (no external API needed) ───────

function generateInsightTexts(
  teams: TeamData[],
  playoffProb: Record<string, number>,
  champProb: Record<string, number>,
  magicNumbers: Record<string, number | null>,
  trends: Record<string, 'UP' | 'DOWN' | 'STABLE'>,
  playoffSpots: number,
  lowConfidence: boolean
): Record<string, string> {
  const results: Record<string, string> = {}
  const allMakePlayoffs = playoffSpots >= teams.length

  // Use wins count as a lightweight variation seed so same-tier teams don't sound identical
  const v = (t: TeamData, options: string[]) => options[t.wins % options.length]

  for (const t of teams) {
    const pProb      = playoffProb[t.team_id]  ?? 0
    const cProb      = champProb[t.team_id]    ?? 0
    const mn         = magicNumbers[t.team_id]
    const trend      = trends[t.team_id]       ?? 'STABLE'
    const gp         = t.wins + t.losses
    const ptDiff     = t.pts_for - t.pts_against
    const ptDiffStr  = ptDiff >= 0 ? `+${ptDiff}` : String(ptDiff)
    const pPct       = Math.round(pProb * 100)
    const cPct       = Math.round(cProb * 100)
    const formPct    = Math.round(t.recent_form * 100)
    const netr       = t.avg_netr.toFixed(1)
    const name       = t.team_name

    const trendLine  = trend === 'UP'   ? 'and their trajectory is pointing up'
                     : trend === 'DOWN' ? 'though momentum has slipped recently'
                     :                   'and holding steady'

    const formLine   = formPct >= 70 ? `They've been hot lately, winning ${formPct}% of their last five games.`
                     : formPct <= 35 ? `Recent form has been a concern — ${formPct}% in their last five games.`
                     :                `Their ${formPct}% recent win rate keeps them in the mix.`

    const netrLine   = parseFloat(netr) >= 6.5 ? `Their roster NETR average of ${netr} is among the highest in the league.`
                     : parseFloat(netr) >= 5.0 ? `A ${netr} roster NETR average gives them a solid talent base.`
                     :                           `Developing roster depth will be key — their ${netr} NETR average leaves room to grow.`

    // ── Early season ──────────────────────────────────────────────────────────
    if (lowConfidence) {
      if (allMakePlayoffs) {
        results[name] = v(t, [
          `Only ${gp} game${gp !== 1 ? 's' : ''} in, so treat these numbers as directional rather than definitive — everyone makes the playoffs, so the real question is who wins the championship. ${name} sits at ${t.wins}-${t.losses} with ${cPct}% championship odds, but small sample sizes mean these projections will shift dramatically. Check back once the league hits five or six games played.`,
          `It's early days for ${name} at ${t.wins}-${t.losses}. Since every team makes the playoffs, the ${cPct}% championship odds are what to watch — and they'll swing with each result at this stage. The seeding picture will get clearer around game five or six.`,
        ])
      } else {
        results[name] = v(t, [
          `Only ${gp} game${gp !== 1 ? 's' : ''} in, so treat these numbers as directional rather than definitive — the playoff picture won't sharpen for a few more weeks. ${name} sits at ${t.wins}-${t.losses}, but with this small a sample, every upcoming game carries outsized weight. Check back once the league hits five or six games played.`,
          `It's early days for ${name} at ${t.wins}-${t.losses}, and the ${pPct}% playoff odds will swing dramatically with each result. Small sample sizes make any projection low-confidence right now. The real story starts to emerge around game five or six.`,
        ])
      }
      continue
    }

    // ── Clinched ──────────────────────────────────────────────────────────────
    if (mn === 0) {
      const champFocus = cPct >= 40 ? `At ${cPct}% championship odds, they're the team to beat in the postseason.`
                       : cPct >= 20 ? `Their ${cPct}% championship odds make them a legitimate title contender.`
                       :              `The ${cPct}% championship probability means the postseason bracket will define their legacy this season.`
      results[name] = allMakePlayoffs
        ? `${name} is ${t.wins}-${t.losses} and everyone's already in — the only question is who takes home the title. ${champFocus} ${netrLine}`
        : `${name} has clinched their playoff spot at ${t.wins}-${t.losses} — the regular season grind is done. ${champFocus} ${netrLine}`
      continue
    }

    // ── Eliminated ────────────────────────────────────────────────────────────
    if (mn === null && gp > 0) {
      results[name] = v(t, [
        `The playoff door has closed for ${name} this season at ${t.wins}-${t.losses}. ${ptDiff >= 0 ? `The ${ptDiffStr} point differential shows they can compete on any given night` : `Tightening that ${ptDiffStr} point differential needs to be the offseason priority`} — the remaining games are a chance to finish with pride and set the tone for next year.`,
        `${name} is out of the playoff race at ${t.wins}-${t.losses}, but that doesn't make the remaining games meaningless. ${formLine} Playing spoiler and finishing above .500 would be a strong way to close out the season.`,
      ])
      continue
    }

    // ── All make playoffs: focus on seeding and championship ──────────────────
    if (allMakePlayoffs) {
      results[name] = v(t, [
        `Everyone's in the playoffs — for ${name} at ${t.wins}-${t.losses}, it's all about championship odds now sitting at ${cPct}%. ${formLine} Seeding will matter when the bracket is set.`,
        `With every team making the postseason, ${name}'s ${cPct}% championship probability is the number to watch. At ${t.wins}-${t.losses} ${trendLine}. ${netrLine}`,
      ])
      continue
    }

    // ── High probability (≥ 70%) ──────────────────────────────────────────────
    if (pProb >= 0.70) {
      const mnNote = mn !== null && mn <= 2 ? `A magic number of ${mn} means they're on the edge of clinching — one big week could seal it.`
                   : mn !== null && mn <= 5  ? `With a magic number of ${mn}, they control their own fate.`
                   :                           `They control their own destiny with ${t.games_remaining} games left to play.`
      results[name] = v(t, [
        `${name} is in the driver's seat at ${pPct}% playoff odds, ${trendLine} at ${t.wins}-${t.losses}. ${mnNote} At ${cPct}% to win it all, they're not just making the playoffs — they're built to make a run.`,
        `With a ${t.wins}-${t.losses} record and ${ptDiffStr} point differential, ${name} looks like a genuine contender ${trendLine}. ${formLine} Their ${pPct}% playoff odds reflect a team that has figured out how to win in this league.`,
      ])
      continue
    }

    // ── Medium probability (40–69%) ───────────────────────────────────────────
    if (pProb >= 0.40) {
      const mnNote = mn !== null ? `Their magic number of ${mn} means there's no room for a losing streak.`
                   :               `The standings are tight, and every game matters.`
      results[name] = v(t, [
        `${name} is right on the playoff bubble at ${pPct}%, ${trendLine} with a ${t.wins}-${t.losses} record. ${mnNote} ${formLine}`,
        `At ${pPct}% playoff odds, ${name} has built something real at ${t.wins}-${t.losses} — but the margin for error is thin. ${netrLine} ${trend === 'UP' ? 'The momentum is there; keep pushing.' : trend === 'DOWN' ? 'Steadying the ship in the next few games is critical.' : 'Consistency down the stretch will determine whether they make it.'}`,
      ])
      continue
    }

    // ── Low probability (< 40%) ───────────────────────────────────────────────
    results[name] = v(t, [
      `${name} is facing an uphill climb at ${pPct}% playoff odds and a ${t.wins}-${t.losses} record. ${t.games_remaining > 0 ? `With ${t.games_remaining} game${t.games_remaining !== 1 ? 's' : ''} left, a strong run could still move the needle` : 'The remaining games are a chance to finish on a high note'}. ${formLine}`,
      `The path to the playoffs is narrow for ${name} at ${pPct}%, but the season isn't over. ${ptDiff > 0 ? `Their ${ptDiffStr} point differential shows they can compete` : `Cleaning up the ${ptDiffStr} point differential would go a long way`} — ${t.games_remaining > 0 ? 'it just has to translate into wins from here.' : 'the effort has been there even when the results weren\'t.'}`,
    ])
  }

  return results
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

  const insightTexts = generateInsightTexts(teamData, playoffProb, champProb, magicNumbers, trends, playoffSpots, lowConfidence)

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
