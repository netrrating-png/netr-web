export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const
// Display order: Mon-first for UI
export const DISPLAY_DOW = [1, 2, 3, 4, 5, 6, 0] as const
export const DISPLAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'] as const

// ── Round-robin generator ────────────────────────────────────────────

function singleRoundRobin(ids: string[]): [string, string][] {
  const arr = ids.length % 2 === 0 ? [...ids] : [...ids, '__BYE__']
  const n = arr.length
  const result: [string, string][] = []
  const rot = arr.slice(1)
  for (let r = 0; r < n - 1; r++) {
    const lineup = [arr[0], ...rot]
    for (let i = 0; i < n / 2; i++) {
      const a = lineup[i], b = lineup[n - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__')
        result.push(r % 2 === 0 ? [a, b] : [b, a])
    }
    rot.push(rot.shift()!)
  }
  return result
}

/**
 * Generates matchup pairs so every team plays exactly gamesPerTeam games.
 * Alternates home/away across multiple round-robin passes.
 */
export function generateMatchups(teamIds: string[], gamesPerTeam: number): [string, string][] {
  if (teamIds.length < 2) return []
  const base = singleRoundRobin(teamIds)
  const counts: Record<string, number> = {}
  const result: [string, string][] = []

  for (let pass = 0; pass < 100; pass++) {
    const round = pass % 2 === 0 ? base : base.map(([a, b]) => [b, a] as [string, string])
    let added = false
    for (const [a, b] of round) {
      if ((counts[a] ?? 0) < gamesPerTeam && (counts[b] ?? 0) < gamesPerTeam) {
        result.push([a, b])
        counts[a] = (counts[a] ?? 0) + 1
        counts[b] = (counts[b] ?? 0) + 1
        added = true
      }
    }
    if (!added || teamIds.every(id => (counts[id] ?? 0) >= gamesPerTeam)) break
  }
  return result
}

// ── Date assignment ──────────────────────────────────────────────────

export type GameSlot = {
  home_team_id: string
  away_team_id: string
  scheduled_at: string
  location: string
  hasConflict?: boolean
}

export type AssignConfig = {
  startDate: string        // 'YYYY-MM-DD'
  gameDays: number[]       // [1,3,6] = Mon,Wed,Sat
  gameTime: string         // '19:00'
  gamesPerDay: number
  minsBetweenGames: number
  location: string
}

export function assignDates(
  matchups: [string, string][],
  teamAvailability: Record<string, number[]>,
  cfg: AssignConfig
): { games: GameSlot[]; conflicts: number } {
  const remaining = [...matchups]
  const scheduled: GameSlot[] = []
  let conflicts = 0
  const [h, m] = cfg.gameTime.split(':').map(Number)
  const cur = new Date(cfg.startDate + 'T12:00:00')

  for (let d = 0; d < 730 && remaining.length > 0; d++) {
    const dow = cur.getDay()
    if (cfg.gameDays.includes(dow)) {
      let slot = 0
      for (let i = 0; i < remaining.length && slot < cfg.gamesPerDay; i++) {
        const [home, away] = remaining[i]
        const homeOk = (teamAvailability[home] ?? cfg.gameDays).includes(dow)
        const awayOk = (teamAvailability[away] ?? cfg.gameDays).includes(dow)
        if (homeOk && awayOk) {
          const dt = new Date(cur)
          dt.setHours(h, m + slot * cfg.minsBetweenGames, 0, 0)
          scheduled.push({ home_team_id: home, away_team_id: away, scheduled_at: dt.toISOString(), location: cfg.location })
          remaining.splice(i--, 1)
          slot++
        }
      }
    }
    cur.setDate(cur.getDate() + 1)
  }

  // Fallback: schedule remaining games ignoring team-specific availability
  for (const [home, away] of remaining) {
    while (!cfg.gameDays.includes(cur.getDay())) cur.setDate(cur.getDate() + 1)
    const dt = new Date(cur)
    dt.setHours(h, m, 0, 0)
    scheduled.push({ home_team_id: home, away_team_id: away, scheduled_at: dt.toISOString(), location: cfg.location, hasConflict: true })
    conflicts++
    cur.setDate(cur.getDate() + 1)
    while (!cfg.gameDays.includes(cur.getDay())) cur.setDate(cur.getDate() + 1)
  }

  return { games: scheduled, conflicts }
}

// ── Playoff bracket definitions ──────────────────────────────────────

export type BracketGame = {
  slot: number          // unique position in bracket
  homeSeed: number      // 0 = winner of prevHomeSlot
  awaySeed: number      // 0 = winner of prevAwaySlot
  prevHomeSlot: number | null
  prevAwaySlot: number | null
}

export type PlayoffRound = {
  roundNum: number
  name: string
  games: BracketGame[]
}

export function getPlayoffBracket(n: number): PlayoffRound[] | null {
  if (n === 2) return [
    { roundNum: 1, name: 'Championship', games: [
      { slot: 1, homeSeed: 1, awaySeed: 2, prevHomeSlot: null, prevAwaySlot: null },
    ]},
  ]
  if (n === 4) return [
    { roundNum: 1, name: 'Semifinals', games: [
      { slot: 1, homeSeed: 1, awaySeed: 4, prevHomeSlot: null, prevAwaySlot: null },
      { slot: 2, homeSeed: 2, awaySeed: 3, prevHomeSlot: null, prevAwaySlot: null },
    ]},
    { roundNum: 2, name: 'Championship', games: [
      { slot: 3, homeSeed: 0, awaySeed: 0, prevHomeSlot: 1, prevAwaySlot: 2 },
    ]},
  ]
  if (n === 6) return [
    { roundNum: 1, name: 'First Round', games: [
      { slot: 1, homeSeed: 3, awaySeed: 6, prevHomeSlot: null, prevAwaySlot: null },
      { slot: 2, homeSeed: 4, awaySeed: 5, prevHomeSlot: null, prevAwaySlot: null },
    ]},
    { roundNum: 2, name: 'Semifinals', games: [
      { slot: 3, homeSeed: 1, awaySeed: 0, prevHomeSlot: null, prevAwaySlot: 1 },
      { slot: 4, homeSeed: 2, awaySeed: 0, prevHomeSlot: null, prevAwaySlot: 2 },
    ]},
    { roundNum: 3, name: 'Championship', games: [
      { slot: 5, homeSeed: 0, awaySeed: 0, prevHomeSlot: 3, prevAwaySlot: 4 },
    ]},
  ]
  if (n === 8) return [
    { roundNum: 1, name: 'Quarterfinals', games: [
      { slot: 1, homeSeed: 1, awaySeed: 8, prevHomeSlot: null, prevAwaySlot: null },
      { slot: 2, homeSeed: 4, awaySeed: 5, prevHomeSlot: null, prevAwaySlot: null },
      { slot: 3, homeSeed: 2, awaySeed: 7, prevHomeSlot: null, prevAwaySlot: null },
      { slot: 4, homeSeed: 3, awaySeed: 6, prevHomeSlot: null, prevAwaySlot: null },
    ]},
    { roundNum: 2, name: 'Semifinals', games: [
      { slot: 5, homeSeed: 0, awaySeed: 0, prevHomeSlot: 1, prevAwaySlot: 2 },
      { slot: 6, homeSeed: 0, awaySeed: 0, prevHomeSlot: 3, prevAwaySlot: 4 },
    ]},
    { roundNum: 3, name: 'Championship', games: [
      { slot: 7, homeSeed: 0, awaySeed: 0, prevHomeSlot: 5, prevAwaySlot: 6 },
    ]},
  ]
  return null
}

export function fmtPreviewRange(games: GameSlot[]): string {
  if (games.length === 0) return ''
  const dates = games.map(g => new Date(g.scheduled_at))
  const first = dates.reduce((a, b) => a < b ? a : b)
  const last  = dates.reduce((a, b) => a > b ? a : b)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return first.getTime() === last.getTime() ? fmt(first) : `${fmt(first)} – ${fmt(last)}`
}
