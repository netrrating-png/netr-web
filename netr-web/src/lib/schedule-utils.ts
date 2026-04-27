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
  court_id?: string
  hasConflict?: boolean
}

export type AssignConfig = {
  startDate: string        // 'YYYY-MM-DD'
  endDate?: string         // optional hard stop — no games scheduled after this date
  gameDays: number[]       // [1,3,6] = Mon,Wed,Sat
  timeSlots: string[]      // fallback slots when dayTimeSlots has no entry for a day
  dayTimeSlots?: Record<number, string[]>  // per-day slots — key is DOW (0=Sun…6=Sat)
  daySlotLocations?: Record<string, string>  // "${dow}:${time}" → location override
  daySlotCourtIds?: Record<string, string>   // "${dow}:${time}" → court_id override
  defaultCourtId?: string                    // fallback court_id when no per-slot override
  location: string
  oneGamePerWeek?: boolean // when true, each team plays at most once per calendar week
  allowRematches?: boolean
  allTeamIds?: string[]    // required when allowRematches=true
  gamesPerTeam?: number    // target per team when allowRematches=true
}

// Returns the Monday of the week containing `date` as YYYY-MM-DD
function weekKey(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().slice(0, 10)
}

export function assignDates(
  matchups: [string, string][],
  teamDayAvail: Record<string, number[]>,
  teamTimeAvail: Record<string, string[]>,
  cfg: AssignConfig
): { games: GameSlot[]; conflicts: number } {
  const defaultSlots = cfg.timeSlots.length > 0 ? cfg.timeSlots : ['19:00']
  const endDate = cfg.endDate ? new Date(cfg.endDate + 'T23:59:59') : null
  const cur = new Date(cfg.startDate + 'T12:00:00')

  if (cfg.allowRematches && cfg.allTeamIds && cfg.gamesPerTeam) {
    return assignDatesFlexible(cfg.allTeamIds, cfg.gamesPerTeam, teamDayAvail, teamTimeAvail, defaultSlots, cfg.dayTimeSlots ?? {}, cfg.gameDays, cfg.location, cur, endDate, !!cfg.oneGamePerWeek, cfg.daySlotLocations, cfg.daySlotCourtIds, cfg.defaultCourtId)
  }

  // ── Round-robin mode ────────────────────────────────────────────
  const remaining = [...matchups]
  const scheduled: GameSlot[] = []
  let conflicts = 0
  const weeklyPlayed = new Set<string>() // `${weekKey}|${teamId}`

  for (let d = 0; d < 730 && remaining.length > 0; d++) {
    if (endDate && cur > endDate) break
    const dow = cur.getDay()
    if (cfg.gameDays.includes(dow)) {
      const wk = weekKey(cur)
      const playedToday = new Set<string>()
      const slots = cfg.dayTimeSlots?.[dow]?.length ? cfg.dayTimeSlots[dow] : defaultSlots
      for (const slot of slots) {
        if (remaining.length === 0) break
        const [h, m] = slot.split(':').map(Number)
        // Pass 1: respect day + time availability
        // Pass 2: respect day only (relax time slot — gym is rented, slot must be filled)
        let found = -1
        for (let pass = 0; pass < 2 && found === -1; pass++) {
          for (let i = 0; i < remaining.length; i++) {
            const [home, away] = remaining[i]
            if (playedToday.has(home) || playedToday.has(away)) continue
            if (cfg.oneGamePerWeek && (weeklyPlayed.has(`${wk}|${home}`) || weeklyPlayed.has(`${wk}|${away}`))) continue
            const homeOkDay = (teamDayAvail[home] ?? cfg.gameDays).includes(dow)
            const awayOkDay = (teamDayAvail[away] ?? cfg.gameDays).includes(dow)
            if (!homeOkDay || !awayOkDay) continue
            if (pass === 0) {
              const homeTimes = teamTimeAvail[home]
              const awayTimes = teamTimeAvail[away]
              if (homeTimes?.length && !homeTimes.includes(slot)) continue
              if (awayTimes?.length && !awayTimes.includes(slot)) continue
            }
            found = i
            break
          }
        }
        if (found >= 0) {
          const [home, away] = remaining[found]
          const dt = new Date(cur)
          dt.setHours(h, m, 0, 0)
          const key = `${dow}:${slot}`
          const slotLoc = cfg.daySlotLocations?.[key] || cfg.location
          const slotCourtId = cfg.daySlotCourtIds?.[key] || cfg.defaultCourtId
          scheduled.push({ home_team_id: home, away_team_id: away, scheduled_at: dt.toISOString(), location: slotLoc, court_id: slotCourtId })
          remaining.splice(found, 1)
          playedToday.add(home)
          playedToday.add(away)
          if (cfg.oneGamePerWeek) {
            weeklyPlayed.add(`${wk}|${home}`)
            weeklyPlayed.add(`${wk}|${away}`)
          }
        }
      }
    }
    cur.setDate(cur.getDate() + 1)
  }

  // Fallback: force-schedule remaining games ignoring availability
  const [fh, fm] = defaultSlots[0].split(':').map(Number)
  if (cfg.gameDays.length > 0 && !isNaN(cur.getTime())) {
    for (const [home, away] of remaining) {
      let g = 0
      while (!cfg.gameDays.includes(cur.getDay()) && g++ < 7) cur.setDate(cur.getDate() + 1)
      if (g >= 7) break
      if (endDate && cur > endDate) break
      const dt = new Date(cur)
      dt.setHours(fh, fm, 0, 0)
      scheduled.push({ home_team_id: home, away_team_id: away, scheduled_at: dt.toISOString(), location: cfg.location, court_id: cfg.defaultCourtId, hasConflict: true })
      conflicts++
      cur.setDate(cur.getDate() + 1)
      g = 0
      while (!cfg.gameDays.includes(cur.getDay()) && g++ < 7) cur.setDate(cur.getDate() + 1)
    }
  }

  return { games: scheduled, conflicts }
}

function assignDatesFlexible(
  teamIds: string[],
  gamesPerTeam: number,
  teamDayAvail: Record<string, number[]>,
  teamTimeAvail: Record<string, string[]>,
  defaultSlots: string[],
  dayTimeSlots: Record<number, string[]>,
  gameDays: number[],
  location: string,
  cur: Date,
  endDate: Date | null,
  oneGamePerWeek: boolean,
  daySlotLocations?: Record<string, string>,
  daySlotCourtIds?: Record<string, string>,
  defaultCourtId?: string
): { games: GameSlot[]; conflicts: number } {
  const scheduled: GameSlot[] = []
  const gameCount: Record<string, number> = {}
  const pairCount: Record<string, number> = {}
  const weeklyPlayed = new Set<string>()
  for (const id of teamIds) gameCount[id] = 0

  const maxDays = endDate ? Infinity : 730
  for (let d = 0; d < maxDays; d++) {
    if (endDate && cur > endDate) break
    if (teamIds.every(id => gameCount[id] >= gamesPerTeam)) break

    const dow = cur.getDay()
    if (gameDays.includes(dow)) {
      const wk = weekKey(cur)
      const slots = dayTimeSlots[dow]?.length ? dayTimeSlots[dow] : defaultSlots
      const availDay = teamIds.filter(id =>
        gameCount[id] < gamesPerTeam &&
        (teamDayAvail[id] ?? gameDays).includes(dow) &&
        (!oneGamePerWeek || !weeklyPlayed.has(`${wk}|${id}`))
      )
      const playedToday = new Set<string>()

      for (const slot of slots) {
        const [h, m] = slot.split(':').map(Number)
        // Pass 1: teams available for this day AND this time slot
        let pool = availDay.filter(id => {
          if (playedToday.has(id)) return false
          const times = teamTimeAvail[id]
          return !times?.length || times.includes(slot)
        })
        // Pass 2: relax time slot — gym is rented, fill the slot with any day-available team
        if (pool.length < 2) {
          pool = availDay.filter(id => !playedToday.has(id))
        }
        if (pool.length < 2) continue

        // Pick the pair with fewest previous matchups (break ties by fewest total games)
        let bestHome = '', bestAway = '', bestScore = Infinity
        for (let i = 0; i < pool.length; i++) {
          for (let j = i + 1; j < pool.length; j++) {
            const [a, b] = [pool[i], pool[j]].sort()
            const key = `${a}|${b}`
            const score = (pairCount[key] ?? 0) * 1000 + gameCount[pool[i]] + gameCount[pool[j]]
            if (score < bestScore) {
              bestScore = score
              bestHome = pool[i]
              bestAway = pool[j]
            }
          }
        }

        const dt = new Date(cur)
        dt.setHours(h, m, 0, 0)
        const slotKey = `${dow}:${slot}`
        const slotLoc = daySlotLocations?.[slotKey] || location
        const slotCourtId = daySlotCourtIds?.[slotKey] || defaultCourtId
        scheduled.push({ home_team_id: bestHome, away_team_id: bestAway, scheduled_at: dt.toISOString(), location: slotLoc, court_id: slotCourtId })
        gameCount[bestHome]++
        gameCount[bestAway]++
        const [a, b] = [bestHome, bestAway].sort()
        pairCount[`${a}|${b}`] = (pairCount[`${a}|${b}`] ?? 0) + 1
        playedToday.add(bestHome)
        playedToday.add(bestAway)
        if (oneGamePerWeek) {
          weeklyPlayed.add(`${wk}|${bestHome}`)
          weeklyPlayed.add(`${wk}|${bestAway}`)
        }
      }
    }
    cur.setDate(cur.getDate() + 1)
  }

  return { games: scheduled, conflicts: 0 }
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
  if (n < 2) return null
  // Preserve exact slot numbers for already-deployed bracket sizes
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
  return buildGeneralBracket(n)
}

function buildGeneralBracket(n: number): PlayoffRound[] {
  // Smallest power-of-2 bracket size that fits n teams
  let size = 1
  while (size < n) size *= 2

  // Standard fold seeding: places 1 and 2 on opposite sides so they only meet in the final
  function foldSeeds(sz: number): number[] {
    if (sz === 2) return [1, 2]
    const half = foldSeeds(sz / 2)
    const result: number[] = []
    for (const s of half) result.push(s, sz + 1 - s)
    return result
  }

  type Entity = { type: 'seed'; seed: number } | { type: 'winner'; slot: number }
  let positions: (Entity | null)[] = foldSeeds(size).map(s =>
    s <= n ? { type: 'seed', seed: s } as Entity : null
  )

  const totalRounds = Math.ceil(Math.log2(n))
  let slotNum = 1
  let roundNum = 1
  const rounds: PlayoffRound[] = []

  while (positions.filter(Boolean).length > 1) {
    const games: BracketGame[] = []
    const next: (Entity | null)[] = []

    for (let i = 0; i < positions.length; i += 2) {
      const a = positions[i]
      const b = positions[i + 1] ?? null
      if (!a && !b) { next.push(null); continue }
      if (!a) { next.push(b); continue }
      if (!b) { next.push(a); continue }
      const game: BracketGame = {
        slot: slotNum,
        homeSeed: a.type === 'seed' ? a.seed : 0,
        awaySeed: b.type === 'seed' ? b.seed : 0,
        prevHomeSlot: a.type === 'winner' ? a.slot : null,
        prevAwaySlot: b.type === 'winner' ? b.slot : null,
      }
      games.push(game)
      next.push({ type: 'winner', slot: slotNum })
      slotNum++
    }

    if (games.length > 0) {
      const fromEnd = totalRounds - roundNum
      const name = fromEnd === 0 ? 'Championship'
        : fromEnd === 1 ? 'Semifinals'
        : fromEnd === 2 ? 'Quarterfinals'
        : `Round ${roundNum}`
      rounds.push({ roundNum, name, games })
      roundNum++
    }
    positions = next
  }

  return rounds
}

export function fmtPreviewRange(games: GameSlot[]): string {
  if (games.length === 0) return ''
  const dates = games.map(g => new Date(g.scheduled_at))
  const first = dates.reduce((a, b) => a < b ? a : b)
  const last  = dates.reduce((a, b) => a > b ? a : b)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return first.getTime() === last.getTime() ? fmt(first) : `${fmt(first)} – ${fmt(last)}`
}
