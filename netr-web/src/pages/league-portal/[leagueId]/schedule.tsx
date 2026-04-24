import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, fetchAllCourts, League, LeagueTeam, LeagueGame, LeagueGameAttendance, LeagueDivision } from '../../../lib/supabase'
import { CourtPicker } from '../../../components/CourtPicker'
import { PortalNav } from './index'
import { DISPLAY_DOW, DISPLAY_LABELS, generateMatchups, assignDates, AssignConfig, GameSlot, getPlayoffBracket, fmtPreviewRange } from '../../../lib/schedule-utils'

type GameWithTeams = LeagueGame & { home_team?: LeagueTeam; away_team?: LeagueTeam }
type StandingRow = { team_id: string; team_name: string; color: string; wins: number; losses: number }

function getWinner(slot: number, playoffGames: GameWithTeams[]): string | null {
  const g = playoffGames.find(g => g.playoff_bracket_slot === slot)
  if (!g || g.status !== 'final' || g.home_score == null || g.away_score == null) return null
  return g.home_score > g.away_score ? g.home_team_id : g.away_team_id
}

export default function SchedulePage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [games, setGames] = useState<GameWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', scheduled_at: '', location: '', court_id: '' })
  const [courts, setCourts] = useState<{ id: string; name: string; city: string }[]>([])

  // tab
  const [tab, setTab] = useState<'regular' | 'playoffs'>('regular')

  // generator
  const [showGenerator, setShowGenerator] = useState(false)
  const [gamesPerTeam, setGamesPerTeam] = useState(10)
  const [genConfig, setGenConfig] = useState<AssignConfig>({ startDate: new Date().toISOString().slice(0,10), gameDays: [1,3], timeSlots: ['19:00'], location: '', allowRematches: false })
  const [preview, setPreview] = useState<GameSlot[] | null>(null)
  const [previewConflicts, setPreviewConflicts] = useState(0)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [newSlotTime, setNewSlotTime] = useState('')

  // team availability
  const [availability, setAvailability] = useState<Record<string, number[]>>({})
  const [teamTimeAvail, setTeamTimeAvail] = useState<Record<string, string[]>>({})

  // attendance (RSVP counts per game)
  const [attendance, setAttendance] = useState<LeagueGameAttendance[]>([])

  // standings for playoffs
  const [standings, setStandings] = useState<StandingRow[]>([])
  const [playoffDate, setPlayoffDate] = useState(new Date().toISOString().slice(0,10))
  const [generatingPlayoffs, setGeneratingPlayoffs] = useState(false)
  const [editingPlayoffSlot, setEditingPlayoffSlot] = useState<number | null>(null)
  const [playoffEditForm, setPlayoffEditForm] = useState({ scheduled_at: '', location: '' })
  const [savingPlayoffEdit, setSavingPlayoffEdit] = useState(false)

  // Divisions
  const [divisions, setDivisions] = useState<LeagueDivision[]>([])
  const [divFilter, setDivFilter] = useState<string>('all')

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, gamesRes, standingsRes, courtsRes, divisionsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId).order('name'),
        supabase.from('league_games').select('*').eq('league_id', leagueId).order('scheduled_at'),
        Promise.resolve(supabase.from('league_standings').select('*').eq('league_id', leagueId).order('wins', { ascending: false })).catch(() => ({ data: [] })),
        fetchAllCourts(),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      const lg = leagueRes.data as League
      setLeague(lg)
      if (lg.games_per_team) setGamesPerTeam(lg.games_per_team)
      setGenConfig(c => ({
        ...c,
        ...(lg.default_game_location ? { location: lg.default_game_location } : {}),
        ...(lg.game_time_slots?.length ? { timeSlots: lg.game_time_slots } : {}),
        ...(lg.season_end_date ? { endDate: lg.season_end_date } : {}),
      }))
      setCourts(courtsRes ?? [])
      if (lg.default_court_id) setForm(f => ({ ...f, court_id: lg.default_court_id! }))

      const teamsList = teamsRes.data ?? []
      const teamsById: Record<string, LeagueTeam> = {}
      for (const t of teamsList) teamsById[t.id] = t
      setTeams(teamsList)

      const avail: Record<string, number[]> = {}
      const timeAvail: Record<string, string[]> = {}
      for (const t of teamsList) {
        avail[t.id] = t.available_days ?? [0,1,2,3,4,5,6]
        timeAvail[t.id] = t.available_times ?? []
      }
      setAvailability(avail)
      setTeamTimeAvail(timeAvail)

      const enriched = (gamesRes.data ?? []).map((g: LeagueGame) => ({
        ...g,
        home_team: teamsById[g.home_team_id],
        away_team: teamsById[g.away_team_id],
      }))
      setGames(enriched)
      setStandings((standingsRes as { data: StandingRow[] | null }).data ?? [])
      const divs = divisionsRes.data ?? []
      setDivisions(divs)
      if (!(lg.cross_division_play ?? true) && divs.length > 0) {
        setDivFilter(divs[0].id)
      }

      const gameIds = (gamesRes.data ?? []).map((g: LeagueGame) => g.id)
      if (gameIds.length > 0) {
        const { data: att } = await supabase
          .from('league_game_attendance')
          .select('game_id,player_id,status')
          .in('game_id', gameIds)
        setAttendance((att ?? []) as LeagueGameAttendance[])
      }

      setLoading(false)
    })
  }, [leagueId])

  function handlePreview() {
    const scopedTeams = divFilter === 'all' ? teams : teams.filter(t => t.division_id === divFilter)
    if (scopedTeams.length < 2) return
    const dayAvail: Record<string, number[]> = {}
    const timeAvail: Record<string, string[]> = {}
    for (const t of scopedTeams) {
      dayAvail[t.id] = availability[t.id] ?? [0,1,2,3,4,5,6]
      timeAvail[t.id] = teamTimeAvail[t.id] ?? []
    }
    const cfg: AssignConfig = genConfig.allowRematches
      ? { ...genConfig, allTeamIds: scopedTeams.map(t => t.id), gamesPerTeam }
      : genConfig
    const matchups = genConfig.allowRematches ? [] : generateMatchups(scopedTeams.map(t => t.id), gamesPerTeam)
    const { games: slots, conflicts } = assignDates(matchups, dayAvail, timeAvail, cfg)
    setPreview(slots)
    setPreviewConflicts(conflicts)
  }

  async function handleSaveSchedule() {
    if (!preview) return
    setSavingSchedule(true)
    const defaultCourtId = league?.default_court_id ?? null
    const divisionId = divFilter !== 'all' ? divFilter : null
    const rows = preview.map(g => ({ league_id: leagueId, home_team_id: g.home_team_id, away_team_id: g.away_team_id, scheduled_at: g.scheduled_at, location: g.location || null, court_id: defaultCourtId, division_id: divisionId, game_type: 'regular', status: 'scheduled' }))
    for (let i = 0; i < rows.length; i += 50) await supabase.from('league_games').insert(rows.slice(i, i+50))
    const { data } = await supabase.from('league_games').select('*').eq('league_id', leagueId).order('scheduled_at')
    const teamsById: Record<string, LeagueTeam> = {}
    for (const t of teams) teamsById[t.id] = t
    setGames((data ?? []).map((g: LeagueGame) => ({ ...g, home_team: teamsById[g.home_team_id], away_team: teamsById[g.away_team_id] })))
    setPreview(null)
    setShowGenerator(false)
    setSavingSchedule(false)
  }

  async function handleAvailChange(teamId: string, day: number, checked: boolean) {
    const curr = availability[teamId] ?? [0,1,2,3,4,5,6]
    const next = checked ? [...curr, day].sort((a,b)=>a-b) : curr.filter(d => d !== day)
    setAvailability(prev => ({ ...prev, [teamId]: next }))
    await supabase.from('league_teams').update({ available_days: next }).eq('id', teamId)
  }

  async function handleAvailTimeChange(teamId: string, slot: string, checked: boolean, allSlots: string[]) {
    const curr = teamTimeAvail[teamId] ?? []
    const expanded = curr.length === 0 ? [...allSlots] : [...curr]
    const next = checked ? Array.from(new Set([...expanded, slot])) : expanded.filter(s => s !== slot)
    const normalized = next.length === allSlots.length ? [] : next
    setTeamTimeAvail(prev => ({ ...prev, [teamId]: normalized }))
    await supabase.from('league_teams').update({ available_times: normalized.length ? normalized : null }).eq('id', teamId)
  }

  async function handleTimeSlotAdd() {
    if (!newSlotTime || genConfig.timeSlots.includes(newSlotTime)) return
    const next = [...genConfig.timeSlots, newSlotTime].sort()
    setGenConfig(c => ({ ...c, timeSlots: next }))
    setNewSlotTime('')
    await supabase.from('leagues').update({ game_time_slots: next }).eq('id', leagueId)
  }

  async function handleTimeSlotRemove(slot: string) {
    const next = genConfig.timeSlots.filter(s => s !== slot)
    setGenConfig(c => ({ ...c, timeSlots: next }))
    await supabase.from('leagues').update({ game_time_slots: next.length ? next : null }).eq('id', leagueId)
  }

  async function handleGeneratePlayoffs() {
    const n = league?.playoff_teams ?? 4
    const bracket = getPlayoffBracket(n)
    if (!bracket) return
    setGeneratingPlayoffs(true)
    const playoffGames = games.filter(g => g.game_type === 'playoff')
    const maxRound = playoffGames.length > 0 ? Math.max(...playoffGames.map(g => g.playoff_round ?? 0)) : 0
    const nextRoundTemplate = bracket.find(r => r.roundNum === maxRound + 1)
    if (!nextRoundTemplate) { setGeneratingPlayoffs(false); return }
    const scheduledAt = new Date(playoffDate + 'T19:00:00').toISOString()
    const newRows: Record<string, unknown>[] = []
    for (const bg of nextRoundTemplate.games) {
      const seedList = divFilter !== 'all' ? standings.filter((s: StandingRow & { division_id?: string }) => s.division_id === divFilter) : standings
      const homeTeamId = bg.prevHomeSlot === null ? (seedList[bg.homeSeed - 1]?.team_id ?? null) : getWinner(bg.prevHomeSlot, playoffGames)
      const awayTeamId = bg.prevAwaySlot === null ? (seedList[bg.awaySeed - 1]?.team_id ?? null) : getWinner(bg.prevAwaySlot, playoffGames)
      if (!homeTeamId || !awayTeamId) continue
      newRows.push({ league_id: leagueId, home_team_id: homeTeamId, away_team_id: awayTeamId, scheduled_at: scheduledAt, location: league?.default_game_location ?? null, court_id: league?.default_court_id ?? null, division_id: divFilter !== 'all' ? divFilter : null, game_type: 'playoff', playoff_round: nextRoundTemplate.roundNum, playoff_bracket_slot: bg.slot, status: 'scheduled' })
    }
    if (newRows.length > 0) {
      const { data } = await supabase.from('league_games').insert(newRows).select()
      if (data) {
        const teamsById: Record<string, LeagueTeam> = {}
        for (const t of teams) teamsById[t.id] = t
        setGames(prev => [...prev, ...(data as LeagueGame[]).map(g => ({ ...g, home_team: teamsById[g.home_team_id], away_team: teamsById[g.away_team_id] }))].sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at)))
      }
    }
    setGeneratingPlayoffs(false)
  }

  async function savePlayoffEdit(gameId: string) {
    setSavingPlayoffEdit(true)
    const updates = {
      scheduled_at: new Date(playoffEditForm.scheduled_at).toISOString(),
      location: playoffEditForm.location || null,
    }
    await supabase.from('league_games').update(updates).eq('id', gameId)
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, ...updates } : g))
    setEditingPlayoffSlot(null)
    setSavingPlayoffEdit(false)
  }

  async function addGame(e: React.FormEvent) {
    e.preventDefault()
    if (form.home_team_id === form.away_team_id) return
    setSaving(true)
    const { data } = await supabase
      .from('league_games')
      .insert({ league_id: leagueId, ...form, location: form.location || null, court_id: form.court_id || null, division_id: divFilter !== 'all' ? divFilter : null, game_type: 'regular', status: 'scheduled' })
      .select()
      .single()

    if (data) {
      const teamsById: Record<string, LeagueTeam> = {}
      for (const t of teams) teamsById[t.id] = t
      setGames(prev => [...prev, { ...data, home_team: teamsById[data.home_team_id], away_team: teamsById[data.away_team_id] }]
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    }
    setForm(f => ({ home_team_id: '', away_team_id: '', scheduled_at: '', location: f.location, court_id: f.court_id }))
    setShowForm(false)
    setSaving(false)
  }

  async function cancelGame(id: string) {
    await supabase.from('league_games').update({ status: 'cancelled' }).eq('id', id)
    setGames(prev => prev.map(g => g.id === id ? { ...g, status: 'cancelled' } : g))
  }

  async function deleteGame(id: string) {
    await supabase.from('league_player_stats').delete().eq('game_id', id)
    await supabase.from('league_games').delete().eq('id', id)
    setGames(prev => prev.filter(g => g.id !== id))
  }

  function editGame(id: string, updates: Partial<LeagueGame>) {
    setGames(prev =>
      prev.map(g => g.id === id ? { ...g, ...updates } : g)
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    )
  }

  if (loading || !league) return <LoadingScreen />

  const crossPlay = league.cross_division_play ?? true
  // When cross_division_play=false, null-division games (created before divisions existed)
  // show under every division tab so existing data isn't invisible.
  const matchesDivFilter = (divId: string | null) =>
    divFilter === 'all' || divId === divFilter || (!crossPlay && divId === null)
  const divTeams = divFilter === 'all' ? teams : teams.filter(t => t.division_id === divFilter || (!crossPlay && t.division_id === null))
  const allRegularGames = games.filter(g => !g.game_type || g.game_type === 'regular')
  const allPlayoffGames = games.filter(g => g.game_type === 'playoff')
  const regularGames = allRegularGames.filter(g => matchesDivFilter(g.division_id ?? null))
  const playoffGames = allPlayoffGames.filter(g => matchesDivFilter(g.division_id ?? null))
  const upcoming = regularGames.filter(g => g.status === 'scheduled')
  const completed = regularGames.filter(g => g.status === 'final')
  const cancelled = regularGames.filter(g => g.status === 'cancelled')
  const divStandings = divFilter === 'all' ? standings : standings.filter((s: StandingRow & { division_id?: string }) => s.division_id === divFilter)

  const n = league.playoff_teams ?? 4
  const bracketTemplate = n > 0 ? getPlayoffBracket(n) : null
  const maxPlayoffRound = playoffGames.length > 0 ? Math.max(...playoffGames.map(g => g.playoff_round ?? 0)) : 0
  const currentRoundGames = playoffGames.filter(g => g.playoff_round === maxPlayoffRound)
  const currentRoundComplete = maxPlayoffRound === 0 || currentRoundGames.every(g => g.status === 'final')
  const allRoundsComplete = !!bracketTemplate && maxPlayoffRound >= bracketTemplate.length && currentRoundComplete

  return (
    <>
      <Head>
        <title>Schedule — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="schedule" logoUrl={league.logo_url} />

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Schedule</h1>
              <p style={S.sub}>{regularGames.length} regular season · {playoffGames.length} playoff</p>
            </div>
            <div style={S.tabSwitch}>
              {(['regular','playoffs'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ ...S.switchBtn, ...(tab === t ? S.switchActive : {}) }}>
                  {t === 'regular' ? 'Regular Season' : `Playoffs${n > 0 ? ` (${n})` : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Division filter tabs */}
          {divisions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {[crossPlay ? { id: 'all', name: 'All' } : null, ...divisions].filter(Boolean).map(d => (
                <button
                  key={d!.id}
                  onClick={() => { setDivFilter(d!.id); setPreview(null) }}
                  style={{
                    background: divFilter === d!.id ? 'rgba(57,255,20,0.12)' : '#0F0F14',
                    border: `1.5px solid ${divFilter === d!.id ? '#39FF14' : '#1C1C26'}`,
                    borderRadius: 8,
                    color: divFilter === d!.id ? '#39FF14' : '#6A6A82',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: 1,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {d!.name}
                </button>
              ))}
            </div>
          )}

          {/* ── REGULAR SEASON TAB ── */}
          {tab === 'regular' && (<>
          {divTeams.length < 2 && (
            <div style={S.notice}>
              Add at least 2 teams before scheduling.{' '}
              <a href={`/league-portal/${leagueId}/teams`} style={{ color: '#39FF14' }}>Add teams →</a>
            </div>
          )}

          {/* Generator toggle row */}
          {divTeams.length >= 2 && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => { setShowGenerator(v => !v); setPreview(null) }} style={S.addBtn}>
                {showGenerator ? '▲ Hide Generator' : '⚙ Generate Schedule'}
              </button>
              <button onClick={() => setShowForm(v => !v)} style={S.outlineBtn}>+ Add Single Game</button>
            </div>
          )}

          {/* Schedule Generator Panel */}
          {showGenerator && (
            <div style={S.genPanel}>
              <div style={S.genTitle}>Schedule Generator</div>
              {/* When divisions don't compete, require a division to be selected first */}
              {!(league.cross_division_play ?? true) && divFilter === 'all' ? (
                <div style={{ textAlign: 'center' as const, padding: '24px 16px' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>☝️</div>
                  <p style={{ color: '#EEEEF5', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, marginBottom: 8 }}>Select a Division First</p>
                  <p style={{ color: '#6A6A82', fontSize: 14 }}>Your divisions don&apos;t compete against each other. Click a division tab above to generate that division&apos;s schedule.</p>
                </div>
              ) : (<>
              {regularGames.length > 0 && <div style={S.genWarn}>⚠ You already have {regularGames.length} regular season game{regularGames.length !== 1 ? 's' : ''}{divFilter !== 'all' ? ' in this division' : ''}. Generating will ADD new games, not replace them.</div>}
              <div style={S.genGrid}>
                <div><label style={S.label}>Games Per Team</label><input type="number" min={1} max={82} value={gamesPerTeam} onChange={e => setGamesPerTeam(parseInt(e.target.value)||1)} style={S.input} /></div>
                <div><label style={S.label}>Season Start Date</label><input type="date" value={genConfig.startDate} onChange={e => setGenConfig(c => ({ ...c, startDate: e.target.value }))} style={S.input} /></div>
                <div>
                  <label style={S.label}>Season End Date <span style={{ color: '#6A6A82', fontWeight: 400, textTransform: 'none' as const }}>(optional)</span></label>
                  <input type="date" value={genConfig.endDate ?? ''} onChange={e => setGenConfig(c => ({ ...c, endDate: e.target.value || undefined }))} style={S.input} />
                </div>
                <div><label style={S.label}>Default Location</label><input type="text" value={genConfig.location} placeholder="Gym name" onChange={e => setGenConfig(c => ({ ...c, location: e.target.value }))} style={S.input} /></div>
              </div>

              {/* Allow rematches toggle */}
              <div style={{ marginBottom: 18, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#EEEEF5' }}>Allow Rematches</div>
                    <div style={{ fontSize: 12, color: '#6A6A82', marginTop: 4 }}>Fill every available slot with any compatible pair. Teams that can&apos;t meet due to schedule conflicts simply won&apos;t play each other — that&apos;s OK.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenConfig(c => ({ ...c, allowRematches: !c.allowRematches }))}
                    style={{
                      background: genConfig.allowRematches ? 'rgba(57,255,20,0.15)' : '#14141C',
                      border: `1.5px solid ${genConfig.allowRematches ? '#39FF14' : '#2E2E3A'}`,
                      borderRadius: 8,
                      color: genConfig.allowRematches ? '#39FF14' : '#6A6A82',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 700,
                      fontSize: 14,
                      textTransform: 'uppercase' as const,
                      letterSpacing: 1,
                      padding: '8px 16px',
                      cursor: 'pointer',
                      flexShrink: 0,
                      minWidth: 80,
                    }}
                  >
                    {genConfig.allowRematches ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Time slots */}
              <div style={{ marginBottom: 18 }}>
                <label style={S.label}>Game Time Slots</label>
                <p style={{ fontSize: 12, color: '#6A6A82', margin: '4px 0 10px' }}>Each slot is one game on a game day. Teams can opt out of specific slots.</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 10 }}>
                  {genConfig.timeSlots.map(slot => (
                    <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0A0A0E', border: '1.5px solid #39FF1444', borderRadius: 8, padding: '5px 10px' }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#EEEEF5' }}>{fmtSlot(slot)}</span>
                      <button type="button" onClick={() => handleTimeSlotRemove(slot)} style={{ background: 'none', border: 'none', color: '#6A6A82', cursor: 'pointer', padding: '0 2px', fontSize: 16, lineHeight: '1', fontFamily: 'sans-serif' }}>×</button>
                    </div>
                  ))}
                  {genConfig.timeSlots.length === 0 && <span style={{ fontSize: 13, color: '#6A6A82' }}>No slots — add at least one.</span>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} style={{ ...S.input, width: 'auto', flex: '0 0 auto' }} />
                  <button type="button" onClick={handleTimeSlotAdd} style={S.outlineBtn} disabled={!newSlotTime || genConfig.timeSlots.includes(newSlotTime)}>+ Add Slot</button>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={S.label}>Game Days</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {DISPLAY_LABELS.map((lbl, i) => { const day = DISPLAY_DOW[i]; const on = genConfig.gameDays.includes(day); return (
                    <button key={day} type="button" onClick={() => setGenConfig(c => ({ ...c, gameDays: on ? c.gameDays.filter(d => d !== day) : [...c.gameDays, day] }))} style={{ ...S.dayChip, ...(on ? S.dayChipOn : {}) }}>{lbl}</button>
                  )})}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={S.label}>Day Availability</label>
                <p style={{ fontSize: 12, color: '#6A6A82', margin: '4px 0 10px' }}>Uncheck days a team can&apos;t play. The scheduler avoids those days for that team.</p>
                <div style={S.availGrid}>
                  <div style={S.availHeader}><div style={S.availTeamCol}/>{DISPLAY_LABELS.map(d => <div key={d} style={S.availDayCol}>{d}</div>)}</div>
                  {divTeams.map(team => {
                    const days = availability[team.id] ?? [0,1,2,3,4,5,6]
                    return (
                      <div key={team.id} style={S.availRow}>
                        <div style={S.availTeamName}><span style={{ width:10, height:10, borderRadius:'50%', background: team.color, display:'inline-block', marginRight:8 }}/>{team.name}</div>
                        {DISPLAY_DOW.map(day => <div key={day} style={S.availCell}><input type="checkbox" checked={days.includes(day)} onChange={e => handleAvailChange(team.id, day, e.target.checked)} /></div>)}
                      </div>
                    )
                  })}
                </div>
                {genConfig.timeSlots.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <label style={S.label}>Time Slot Availability</label>
                    <p style={{ fontSize: 12, color: '#6A6A82', margin: '4px 0 10px' }}>Uncheck slots a team can&apos;t play. By default teams are available for all slots.</p>
                    <div style={S.availGrid}>
                      <div style={S.availHeader}>
                        <div style={S.availTeamCol} />
                        {genConfig.timeSlots.map(s => <div key={s} style={{ ...S.availDayCol, width: 56, fontSize: 10 }}>{fmtSlot(s)}</div>)}
                      </div>
                      {divTeams.map(team => {
                        const times = teamTimeAvail[team.id] ?? []
                        return (
                          <div key={team.id} style={S.availRow}>
                            <div style={S.availTeamName}><span style={{ width:10, height:10, borderRadius:'50%', background: team.color, display:'inline-block', marginRight:8 }}/>{team.name}</div>
                            {genConfig.timeSlots.map(slot => (
                              <div key={slot} style={{ ...S.availCell, width: 56 }}>
                                <input type="checkbox"
                                  checked={times.length === 0 || times.includes(slot)}
                                  onChange={e => handleAvailTimeChange(team.id, slot, e.target.checked, genConfig.timeSlots)}
                                />
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              {preview ? (
                <div style={S.previewBox}>
                  <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:16, marginBottom:10 }}>Preview</div>
                  <div style={{ display:'flex', gap:20, flexWrap:'wrap' as const, marginBottom:12, fontSize:14 }}>
                    <span><strong style={{ color:'#EEEEF5' }}>{preview.length}</strong> games</span>
                    <span style={{ color:'#6A6A82' }}>{fmtPreviewRange(preview)}</span>
                  </div>

                  {/* Long-range warning */}
                  {(() => {
                    if (preview.length < 2) return null
                    const dates = preview.map(g => new Date(g.scheduled_at))
                    const spanDays = (Math.max(...dates.map(d => d.getTime())) - Math.min(...dates.map(d => d.getTime()))) / 86400000
                    if (spanDays > 180) return (
                      <div style={{ background:'rgba(245,197,66,0.08)', border:'1px solid rgba(245,197,66,0.25)', borderRadius:8, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#F5C542' }}>
                        ⚠ Schedule spans {Math.round(spanDays / 30)} months — your availability settings may be too restrictive. Try opening up more game days or time slots.
                      </div>
                    )
                    return null
                  })()}

                  {/* Conflict detail */}
                  {previewConflicts > 0 && (() => {
                    const teamsById: Record<string, LeagueTeam> = {}
                    for (const t of divTeams) teamsById[t.id] = t
                    const conflictGames = preview.filter(g => g.hasConflict)
                    return (
                      <div style={{ background:'rgba(245,197,66,0.06)', border:'1px solid rgba(245,197,66,0.2)', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
                        <div style={{ fontSize:13, color:'#F5C542', fontWeight:600, marginBottom:8 }}>
                          ⚠ {previewConflicts} conflict{previewConflicts!==1?'s':''} — scheduled ignoring availability:
                        </div>
                        {conflictGames.map((g, i) => {
                          const home = teamsById[g.home_team_id]?.name ?? g.home_team_id
                          const away = teamsById[g.away_team_id]?.name ?? g.away_team_id
                          const d = new Date(g.scheduled_at)
                          const dateStr = d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
                          return (
                            <div key={i} style={{ fontSize:13, color:'#EEEEF5', padding:'4px 0', borderTop: i > 0 ? '1px solid rgba(245,197,66,0.1)' : 'none' }}>
                              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700 }}>{home} vs {away}</span>
                              <span style={{ color:'#6A6A82', marginLeft:10, fontFamily:"'DM Mono',monospace", fontSize:11 }}>{dateStr}</span>
                            </div>
                          )
                        })}
                        <div style={{ fontSize:12, color:'#6A6A82', marginTop:8 }}>
                          Fix: open up more availability for these teams, then re-preview.
                        </div>
                      </div>
                    )
                  })()}

                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setPreview(null)} style={S.cancelBtn}>Clear</button>
                    <button onClick={handleSaveSchedule} style={S.saveBtn} disabled={savingSchedule}>{savingSchedule ? 'Saving…' : `Save ${preview.length} Games`}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button onClick={handlePreview} style={S.saveBtn} disabled={genConfig.gameDays.length===0 || genConfig.timeSlots.length===0}>Preview Schedule</button>
                </div>
              )}
              </>)}
            </div>
          )}

          {/* Manual add-game form */}
          {showForm && (
            <form onSubmit={addGame} style={S.inlineForm}>
              <h3 style={S.formTitle}>Add Single Game</h3>
              <div style={S.formGrid}>
                <div>
                  <label style={S.label}>Home Team *</label>
                  <select value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))} style={S.select} required>
                    <option value="">Select team…</option>
                    {divTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={S.vsLabel}>VS</div>
                <div>
                  <label style={S.label}>Away Team *</label>
                  <select value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))} style={S.select} required>
                    <option value="">Select team…</option>
                    {divTeams.filter(t => t.id !== form.home_team_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Date & Time *</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} style={S.input} required />
                </div>
                <div>
                  <label style={S.label}>Location</label>
                  {courts.length > 0 && (
                    <div style={{ marginBottom: 6 }}>
                      <CourtPicker
                        courts={courts}
                        courtId={form.court_id}
                        onChange={(id, name) => setForm(f => ({ ...f, court_id: id, location: name || f.location }))}
                      />
                    </div>
                  )}
                  <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} style={S.input} placeholder="Gym or court name" />
                </div>
              </div>
              {form.home_team_id === form.away_team_id && form.home_team_id && (
                <div style={S.error}>Home and away team must be different.</div>
              )}
              <div style={S.formActions}>
                <button type="button" onClick={() => setShowForm(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.saveBtn} disabled={saving}>{saving ? 'Adding…' : 'Add Game'}</button>
              </div>
            </form>
          )}

          {/* Completed — shown first so recently saved games are immediately visible */}
          {completed.length > 0 && (
            <section style={S.section}>
              <div style={S.sectionLabel}>Results ({completed.length})</div>
              <div style={S.gameList}>
                {[...completed].reverse().map(g => <GameRow key={g.id} game={g} teams={divTeams} onDelete={() => deleteGame(g.id)} onEdit={editGame} leagueId={leagueId} rsvpYes={attendance.filter(a => a.game_id === g.id && a.status === 'yes').length} />)}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section style={S.section}>
              <div style={S.sectionLabel}>Upcoming ({upcoming.length})</div>
              <div style={S.gameList}>
                {upcoming.map(g => <GameRow key={g.id} game={g} teams={divTeams} onCancel={() => cancelGame(g.id)} onDelete={() => deleteGame(g.id)} onEdit={editGame} leagueId={leagueId} rsvpYes={attendance.filter(a => a.game_id === g.id && a.status === 'yes').length} />)}
              </div>
            </section>
          )}

          {/* Cancelled — always shown so commissioner can delete them */}
          {cancelled.length > 0 && (
            <section style={S.section}>
              <div style={S.sectionLabel}>Cancelled ({cancelled.length})</div>
              <div style={S.gameList}>
                {cancelled.map(g => <GameRow key={g.id} game={g} teams={divTeams} onDelete={() => deleteGame(g.id)} leagueId={leagueId} />)}
              </div>
            </section>
          )}

          {upcoming.length === 0 && completed.length === 0 && cancelled.length === 0 && !showGenerator && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>📅</div>
              <p style={S.emptyText}>No regular season games yet.</p>
              {divTeams.length >= 2 ? <button onClick={() => setShowGenerator(true)} style={S.saveBtn}>Generate Schedule</button> : <a href={`/league-portal/${leagueId}/teams`} style={{ color:'#39FF14' }}>Add teams first →</a>}
            </div>
          )}
          </>)}

          {/* ── PLAYOFFS TAB ── */}
          {tab === 'playoffs' && (<>
            {n === 0 ? (
              <div style={S.notice}>Playoffs not configured. Go to <a href={`/league-portal/${leagueId}/settings`} style={{ color:'#39FF14' }}>Settings</a> to set the number of playoff teams.</div>
            ) : (<>
              {divStandings.length > 0 && (
                <div style={{ ...S.inlineForm, marginBottom:24 }}>
                  <div style={S.sectionLabel}>Current Seedings (top {n})</div>
                  {divStandings.slice(0, n).map((s, i) => (
                    <div key={s.team_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderBottom:'1px solid #14141C' }}>
                      <span style={{ fontFamily:"'DM Mono',monospace", color:'#6A6A82', minWidth:24 }}>#{i+1}</span>
                      <span style={{ width:10, height:10, borderRadius:'50%', background:s.color, display:'inline-block' }}/>
                      <span style={{ flex:1, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17 }}>{s.team_name}</span>
                      <span style={{ fontFamily:"'DM Mono',monospace", fontSize:13, color:'#6A6A82' }}>{s.wins}–{s.losses}</span>
                    </div>
                  ))}
                  <div style={{ fontSize:12, color:'#6A6A82', marginTop:10 }}>Seedings are based on regular season standings.</div>
                </div>
              )}

              {bracketTemplate && bracketTemplate.map(round => {
                const roundGames = playoffGames.filter(g => g.playoff_round === round.roundNum)
                const roundComplete = roundGames.length === round.games.length && roundGames.every(g => g.status === 'final')
                return (
                  <div key={round.roundNum} style={{ marginBottom:24 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={S.sectionLabel}>Round {round.roundNum} — {round.name}</div>
                      {roundComplete && <span style={{ background:'rgba(57,255,20,0.12)', color:'#39FF14', fontSize:11, fontFamily:"'DM Mono',monospace", padding:'2px 10px', borderRadius:99 }}>✓ Complete</span>}
                      {!roundComplete && roundGames.length > 0 && <span style={{ background:'rgba(245,197,66,0.12)', color:'#F5C542', fontSize:11, fontFamily:"'DM Mono',monospace", padding:'2px 10px', borderRadius:99 }}>In Progress</span>}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column' as const, gap:8 }}>
                      {round.games.map(bg => {
                        const dbg = playoffGames.find(g => g.playoff_bracket_slot === bg.slot)
                        const homeName = dbg?.home_team?.name ?? (bg.prevHomeSlot === null ? `#${bg.homeSeed} Seed` : `W Game ${bg.prevHomeSlot}`)
                        const awayName = dbg?.away_team?.name ?? (bg.prevAwaySlot === null ? `#${bg.awaySeed} Seed` : `W Game ${bg.prevAwaySlot}`)
                        return (
                          <div key={bg.slot} style={{ ...S.bracketRow, flexDirection: editingPlayoffSlot === bg.slot ? 'column' as const : 'row' as const, alignItems: editingPlayoffSlot === bg.slot ? 'stretch' : 'center' }}>
                            {editingPlayoffSlot === bg.slot && dbg ? (
                              <>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                                  <div>
                                    <label style={S.label}>Date &amp; Time</label>
                                    <input type="datetime-local" value={playoffEditForm.scheduled_at} onChange={e => setPlayoffEditForm(f => ({ ...f, scheduled_at: e.target.value }))} style={S.input} />
                                  </div>
                                  <div>
                                    <label style={S.label}>Location</label>
                                    <input type="text" value={playoffEditForm.location} onChange={e => setPlayoffEditForm(f => ({ ...f, location: e.target.value }))} style={S.input} placeholder="Gym or court name" />
                                  </div>
                                </div>
                                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                                  <button onClick={() => setEditingPlayoffSlot(null)} style={S.cancelBtn}>Cancel</button>
                                  <button onClick={() => savePlayoffEdit(dbg.id)} style={S.saveBtn} disabled={savingPlayoffEdit || !playoffEditForm.scheduled_at}>{savingPlayoffEdit ? 'Saving…' : 'Save Changes'}</button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ flex:1 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                                    {dbg?.home_team && <span style={{ width:8, height:8, borderRadius:'50%', background:dbg.home_team.color, display:'inline-block' }}/>}
                                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color: dbg?.status==='final' && (dbg.home_score??0) > (dbg.away_score??0) ? '#39FF14' : '#EEEEF5' }}>{homeName}</span>
                                    {dbg?.status==='final' && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, marginLeft:'auto', color:'#EEEEF5' }}>{dbg.home_score}</span>}
                                  </div>
                                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                    {dbg?.away_team && <span style={{ width:8, height:8, borderRadius:'50%', background:dbg.away_team.color, display:'inline-block' }}/>}
                                    <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:17, color: dbg?.status==='final' && (dbg.away_score??0) > (dbg.home_score??0) ? '#39FF14' : '#EEEEF5' }}>{awayName}</span>
                                    {dbg?.status==='final' && <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, marginLeft:'auto', color:'#EEEEF5' }}>{dbg.away_score}</span>}
                                  </div>
                                </div>
                                <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
                                  {!dbg && <span style={{ fontSize:11, color:'#6A6A82', fontFamily:"'DM Mono',monospace" }}>TBD</span>}
                                  {dbg?.status==='scheduled' && <>
                                    <span style={{ fontSize:12, color:'#6A6A82' }}>{new Date(dbg.scheduled_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                                    <a href={`/league-portal/${leagueId}/score/${dbg.id}`} style={S.scoreBtn}>Enter Score + Stats</a>
                                    <button onClick={() => { setEditingPlayoffSlot(bg.slot); setPlayoffEditForm({ scheduled_at: dbg.scheduled_at.slice(0,16), location: dbg.location ?? '' }) }} style={S.cancelSmBtn}>Edit</button>
                                  </>}
                                  {dbg?.status==='final' && <>
                                    <span style={S.finalBadge}>Final</span>
                                    <a href={`/league-portal/${leagueId}/score/${dbg.id}`} style={S.boxBtn}>Box Score</a>
                                  </>}
                                  {dbg && <button onClick={() => deleteGame(dbg.id)} style={S.deleteSmBtn}>Delete</button>}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {!allRoundsComplete && (
                <div style={{ ...S.inlineForm, marginTop:8 }}>
                  <div style={{ marginBottom:12 }}>
                    <label style={S.label}>{maxPlayoffRound === 0 ? 'Playoff Start Date' : `Round ${maxPlayoffRound+1} Date`}</label>
                    <input type="date" value={playoffDate} onChange={e => setPlayoffDate(e.target.value)} style={{ ...S.input, maxWidth:200, marginTop:6 }} />
                  </div>
                  {maxPlayoffRound === 0 ? (
                    <button onClick={handleGeneratePlayoffs} style={S.saveBtn} disabled={generatingPlayoffs || divStandings.length < n || !playoffDate}>
                      {generatingPlayoffs ? 'Generating…' : `Generate Round 1 Bracket (${n} teams)`}
                    </button>
                  ) : currentRoundComplete ? (
                    <button onClick={handleGeneratePlayoffs} style={S.saveBtn} disabled={generatingPlayoffs || !playoffDate}>
                      {generatingPlayoffs ? 'Generating…' : `Generate Round ${maxPlayoffRound+1}`}
                    </button>
                  ) : (
                    <div style={{ color:'#6A6A82', fontSize:14 }}>⏳ Enter all Round {maxPlayoffRound} results before generating Round {maxPlayoffRound+1}.</div>
                  )}
                  {maxPlayoffRound === 0 && divStandings.length < n && <p style={{ fontSize:12, color:'#F5C542', marginTop:8 }}>Need {n - divStandings.length} more team{n - divStandings.length !== 1 ? 's' : ''} in standings.</p>}
                </div>
              )}
              {allRoundsComplete && <div style={{ textAlign:'center' as const, padding:'32px', fontSize:24, fontFamily:"'Barlow Condensed',sans-serif", fontWeight:900, color:'#39FF14' }}>🏆 Playoffs Complete!</div>}
            </>)}
          </>)}
        </main>

      </div>
    </>
  )
}

function fmtSlot(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

function GameRow({ game, teams = [], onCancel, onDelete, onEdit, leagueId, rsvpYes = 0 }: {
  game: GameWithTeams
  teams?: LeagueTeam[]
  onCancel?: () => void
  onDelete?: () => void
  onEdit?: (id: string, updates: Partial<LeagueGame>) => void
  leagueId: string
  rsvpYes?: number
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    scheduled_at: game.scheduled_at.slice(0, 16),
    location: game.location ?? '',
    home_team_id: game.home_team_id,
    away_team_id: game.away_team_id,
  })
  const [savingEdit, setSavingEdit] = useState(false)

  async function saveEdit() {
    if (editForm.home_team_id === editForm.away_team_id) return
    setSavingEdit(true)
    const updates: Partial<LeagueGame> = {
      scheduled_at: new Date(editForm.scheduled_at).toISOString(),
      location: editForm.location || null,
      home_team_id: editForm.home_team_id,
      away_team_id: editForm.away_team_id,
    }
    await supabase.from('league_games').update(updates).eq('id', game.id)
    onEdit?.(game.id, {
      ...updates,
      home_team: teams.find(t => t.id === editForm.home_team_id),
      away_team: teams.find(t => t.id === editForm.away_team_id),
    } as Partial<LeagueGame>)
    setSavingEdit(false)
    setEditing(false)
  }

  if (!game.home_team || !game.away_team) return null
  const d = new Date(game.scheduled_at)
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  if (editing) {
    return (
      <div style={{ ...S.gameRow, flexDirection: 'column' as const, alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <div>
            <label style={S.label}>Home Team</label>
            <select value={editForm.home_team_id} onChange={e => setEditForm(f => ({ ...f, home_team_id: e.target.value }))} style={S.select}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Away Team</label>
            <select value={editForm.away_team_id} onChange={e => setEditForm(f => ({ ...f, away_team_id: e.target.value }))} style={S.select}>
              {teams.filter(t => t.id !== editForm.home_team_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Date & Time</label>
            <input type="datetime-local" value={editForm.scheduled_at} onChange={e => setEditForm(f => ({ ...f, scheduled_at: e.target.value }))} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Location</label>
            <input type="text" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} style={S.input} placeholder="Gym or court name" />
          </div>
        </div>
        {editForm.home_team_id === editForm.away_team_id && (
          <div style={{ fontSize: 12, color: '#FF453A' }}>Home and away team must be different.</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setEditing(false)} style={S.cancelBtn}>Cancel</button>
          <button onClick={saveEdit} style={S.saveBtn} disabled={savingEdit || editForm.home_team_id === editForm.away_team_id}>
            {savingEdit ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...S.gameRow, opacity: game.status === 'cancelled' ? 0.45 : 1 }}>
      <div style={S.gameDate}>
        <div style={S.gameDateMain}>{dateStr}</div>
        <div style={S.gameTime}>{timeStr}</div>
        {game.location && <div style={S.gameLocation}>📍 {game.location}</div>}
      </div>

      <div style={S.gameMatchup}>
        <TeamChip team={game.home_team} score={game.home_score} won={game.status === 'final' && game.home_score! > game.away_score!} />
        <span style={S.gameVs}>vs</span>
        <TeamChip team={game.away_team} score={game.away_score} won={game.status === 'final' && game.away_score! > game.home_score!} />
      </div>

      <div style={S.gameActions}>
        {game.status === 'scheduled' && rsvpYes > 0 && (
          <span style={{ fontSize: 12, color: '#39FF14', fontFamily: "'DM Mono', monospace", background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.2)', borderRadius: 99, padding: '3px 10px' }}>
            ✓ {rsvpYes} in
          </span>
        )}
        {game.status === 'final' && <span style={S.finalBadge}>Final</span>}
        {game.status === 'cancelled' && <span style={{ ...S.finalBadge, background: 'rgba(255,69,58,0.1)', color: '#FF453A' }}>Cancelled</span>}
        {game.status === 'scheduled' && (
          <a href={`/league-portal/${leagueId}/score/${game.id}`} style={S.scoreBtn}>Enter Score</a>
        )}
        {game.status === 'final' && (
          <a href={`/league-portal/${leagueId}/score/${game.id}`} style={S.editBtn}>Box Score</a>
        )}
        {game.status === 'scheduled' && onEdit && (
          <button onClick={() => setEditing(true)} style={S.cancelSmBtn}>Edit</button>
        )}
        {game.status === 'scheduled' && onCancel && (
          <button onClick={onCancel} style={S.cancelSmBtn}>Cancel Game</button>
        )}
        {onDelete && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} style={S.deleteSmBtn}>Delete</button>
        )}
        {onDelete && confirmDelete && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#FF453A' }}>Delete?</span>
            <button onClick={onDelete} style={{ ...S.cancelSmBtn, color: '#FF453A', borderColor: '#FF453A' }}>Yes</button>
            <button onClick={() => setConfirmDelete(false)} style={S.cancelSmBtn}>No</button>
          </span>
        )}
      </div>
    </div>
  )
}

function TeamChip({ team, score, won }: { team: LeagueTeam; score: number | null; won: boolean }) {
  return (
    <div style={S.teamChip}>
      <div style={{ ...S.chipDot, background: team.color }} />
      <span style={{ ...S.chipName, color: won ? '#EEEEF5' : '#A0A0B8' }}>{team.name}</span>
      {score !== null && <span style={{ ...S.chipScore, color: won ? '#39FF14' : '#6A6A82', fontWeight: won ? 700 : 400 }}>{score}</span>}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#040406', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: '#39FF14', letterSpacing: 2 }}>LOADING…</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap' as const, gap: 16 },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, marginBottom: 4 },
  sub: { color: '#6A6A82', fontSize: 14 },
  addBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 8, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 20px', cursor: 'pointer' },
  notice: { background: '#1A1408', border: '1px solid #F5C54230', borderRadius: 8, color: '#F5C542', fontSize: 14, padding: '12px 16px', marginBottom: 20 },
  inlineForm: { background: '#0F0F14', border: '1px solid #39FF1444', borderRadius: 12, padding: 24, marginBottom: 24 },
  formTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 20 },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, alignItems: 'end', marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 },
  select: { width: '100%', background: '#0A0A0D', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' as const },
  input: { width: '100%', background: '#0A0A0D', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', boxSizing: 'border-box' as const },
  vsLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: '#6A6A82', textAlign: 'center' as const, paddingBottom: 10 },
  error: { color: '#FF4545', fontSize: 13, marginBottom: 12 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 8, color: '#6A6A82', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '8px 18px', cursor: 'pointer' },
  saveBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 8, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 22px', cursor: 'pointer' },
  section: { marginBottom: 36 },
  sectionLabel: { fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", marginBottom: 12 },
  gameList: { display: 'flex', flexDirection: 'column' as const, gap: 8 },
  gameRow: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const },
  gameDate: { minWidth: 110 },
  gameDateMain: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, letterSpacing: 0.5 },
  gameTime: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  gameLocation: { fontSize: 11, color: '#6A6A82', marginTop: 2 },
  gameMatchup: { flex: 1, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  gameVs: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  teamChip: { display: 'flex', alignItems: 'center', gap: 8 },
  chipDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  chipName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const },
  chipScore: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, marginLeft: 4 },
  gameActions: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  finalBadge: { background: 'rgba(57,255,20,0.12)', color: '#39FF14', fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '3px 10px', borderRadius: 99, letterSpacing: 0.5 },
  scoreBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 7, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '7px 14px', cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap' as const },
  editBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 7, color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 12px', textDecoration: 'none', whiteSpace: 'nowrap' as const },
  cancelSmBtn: { background: 'none', border: '1px solid #2E2E3A', borderRadius: 7, color: '#6A6A82', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  deleteSmBtn: { background: 'none', border: '1px solid #FF453A44', borderRadius: 7, color: '#FF453A', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" },
  empty: { textAlign: 'center' as const, padding: '60px 24px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#6A6A82', fontSize: 15 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { background: '#0F0F14', border: '1px solid #2E2E3A', borderRadius: 16, padding: '36px', width: '100%', maxWidth: 480 },
  modalTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, textTransform: 'uppercase' as const, marginBottom: 24 },
  scoreRow: { display: 'flex', alignItems: 'center', gap: 20 },
  scoreTeam: { flex: 1, textAlign: 'center' as const },
  scoreTeamDot: { width: 16, height: 16, borderRadius: '50%', margin: '0 auto 8px' },
  scoreTeamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, marginBottom: 10 },
  scoreInput: { width: '100%', background: '#0A0A0D', border: '2px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 40, fontWeight: 900, padding: '12px', outline: 'none', textAlign: 'center' as const, boxSizing: 'border-box' as const },
  scoreDash: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, color: '#2E2E3A', flexShrink: 0 },
  modalNote: { marginTop: 16, textAlign: 'center' as const, fontSize: 13, color: '#6A6A82' },
  // tab switcher
  tabSwitch: { display: 'flex', gap: 0, background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 10, overflow: 'hidden' },
  switchBtn: { border: 'none', background: 'transparent', color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 20px', cursor: 'pointer' },
  switchActive: { background: '#39FF1420', color: '#39FF14' },
  // generator
  outlineBtn: { background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 18px', cursor: 'pointer' },
  genPanel: { background: '#0F0F14', border: '1px solid #39FF1422', borderRadius: 14, padding: 24, marginBottom: 24 },
  genTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 16 },
  genWarn: { background: '#1A1408', border: '1px solid #F5C54230', borderRadius: 8, color: '#F5C542', fontSize: 13, padding: '10px 14px', marginBottom: 16 },
  genGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 18 },
  dayChip: { border: '1.5px solid #1C1C26', borderRadius: 8, background: '#0A0A0E', color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, padding: '7px 12px', cursor: 'pointer' },
  dayChipOn: { background: 'rgba(57,255,20,0.12)', borderColor: '#39FF14', color: '#39FF14' },
  // availability grid
  availGrid: { background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, overflow: 'hidden' },
  availHeader: { display: 'flex', alignItems: 'center', borderBottom: '1px solid #1C1C26', padding: '6px 12px' },
  availTeamCol: { flex: 1 },
  availDayCol: { width: 36, textAlign: 'center' as const, fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  availRow: { display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #14141C' },
  availTeamName: { flex: 1, fontSize: 13, display: 'flex', alignItems: 'center' },
  availCell: { width: 36, display: 'flex', justifyContent: 'center' as const },
  // preview box
  previewBox: { background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, padding: 16 },
  // bracket
  bracketRow: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 },
}
