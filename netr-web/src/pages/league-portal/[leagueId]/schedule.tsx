import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueTeam, LeagueGame } from '../../../lib/supabase'
import { PortalNav } from './index'

type GameWithTeams = LeagueGame & { home_team: LeagueTeam; away_team: LeagueTeam }

export default function SchedulePage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [games, setGames] = useState<GameWithTeams[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ home_team_id: '', away_team_id: '', scheduled_at: '', location: '' })
  const [scoreGame, setScoreGame] = useState<GameWithTeams | null>(null)
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, gamesRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId).order('name'),
        supabase.from('league_games').select('*').eq('league_id', leagueId).order('scheduled_at'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)

      const teamsById: Record<string, LeagueTeam> = {}
      for (const t of (teamsRes.data ?? [])) teamsById[t.id] = t
      setTeams(teamsRes.data ?? [])

      const enriched = (gamesRes.data ?? []).map(g => ({
        ...g,
        home_team: teamsById[g.home_team_id],
        away_team: teamsById[g.away_team_id],
      })).filter(g => g.home_team && g.away_team)

      setGames(enriched)
      setLoading(false)
    })
  }, [leagueId])

  async function addGame(e: React.FormEvent) {
    e.preventDefault()
    if (form.home_team_id === form.away_team_id) return
    setSaving(true)
    const { data } = await supabase
      .from('league_games')
      .insert({ league_id: leagueId, ...form, location: form.location || null })
      .select()
      .single()

    if (data) {
      const teamsById: Record<string, LeagueTeam> = {}
      for (const t of teams) teamsById[t.id] = t
      setGames(prev => [...prev, { ...data, home_team: teamsById[data.home_team_id], away_team: teamsById[data.away_team_id] }]
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)))
    }
    setForm({ home_team_id: '', away_team_id: '', scheduled_at: '', location: '' })
    setShowForm(false)
    setSaving(false)
  }

  async function finalizeScore(e: React.FormEvent) {
    e.preventDefault()
    if (!scoreGame) return
    setSaving(true)
    const { data } = await supabase
      .from('league_games')
      .update({ home_score: parseInt(homeScore), away_score: parseInt(awayScore), status: 'final' })
      .eq('id', scoreGame.id)
      .select()
      .single()

    if (data) {
      setGames(prev => prev.map(g => g.id === data.id ? { ...g, ...data } : g))
    }
    setScoreGame(null)
    setHomeScore('')
    setAwayScore('')
    setSaving(false)
  }

  async function cancelGame(id: string) {
    await supabase.from('league_games').update({ status: 'cancelled' }).eq('id', id)
    setGames(prev => prev.map(g => g.id === id ? { ...g, status: 'cancelled' } : g))
  }

  if (loading || !league) return <LoadingScreen />

  const upcoming = games.filter(g => g.status === 'scheduled')
  const completed = games.filter(g => g.status === 'final')
  const cancelled = games.filter(g => g.status === 'cancelled')

  return (
    <>
      <Head>
        <title>Schedule — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="schedule" />

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Schedule & Scores</h1>
              <p style={S.sub}>{games.length} game{games.length !== 1 ? 's' : ''} total · {completed.length} played</p>
            </div>
            <button onClick={() => setShowForm(true)} style={S.addBtn} disabled={teams.length < 2}>
              + Add Game
            </button>
          </div>

          {teams.length < 2 && (
            <div style={S.notice}>
              You need at least 2 teams before scheduling games.{' '}
              <a href={`/league-portal/${leagueId}/teams`} style={{ color: '#39FF14' }}>Add teams →</a>
            </div>
          )}

          {/* Add game form */}
          {showForm && (
            <form onSubmit={addGame} style={S.inlineForm}>
              <h3 style={S.formTitle}>Schedule a Game</h3>
              <div style={S.formGrid}>
                <div>
                  <label style={S.label}>Home Team *</label>
                  <select value={form.home_team_id} onChange={e => setForm(f => ({ ...f, home_team_id: e.target.value }))} style={S.select} required>
                    <option value="">Select team…</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div style={S.vsLabel}>VS</div>
                <div>
                  <label style={S.label}>Away Team *</label>
                  <select value={form.away_team_id} onChange={e => setForm(f => ({ ...f, away_team_id: e.target.value }))} style={S.select} required>
                    <option value="">Select team…</option>
                    {teams.filter(t => t.id !== form.home_team_id).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={S.label}>Date & Time *</label>
                  <input type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} style={S.input} required />
                </div>
                <div>
                  <label style={S.label}>Location</label>
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

          {/* Score entry modal */}
          {scoreGame && (
            <div style={S.overlay}>
              <form onSubmit={finalizeScore} style={S.modal}>
                <h3 style={S.modalTitle}>Enter Final Score</h3>
                <div style={S.scoreRow}>
                  <div style={S.scoreTeam}>
                    <div style={{ ...S.scoreTeamDot, background: scoreGame.home_team.color }} />
                    <div style={S.scoreTeamName}>{scoreGame.home_team.name}</div>
                    <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)} style={S.scoreInput} placeholder="0" required autoFocus />
                  </div>
                  <div style={S.scoreDash}>—</div>
                  <div style={S.scoreTeam}>
                    <div style={{ ...S.scoreTeamDot, background: scoreGame.away_team.color }} />
                    <div style={S.scoreTeamName}>{scoreGame.away_team.name}</div>
                    <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)} style={S.scoreInput} placeholder="0" required />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24 }}>
                  <button type="button" onClick={() => setScoreGame(null)} style={S.cancelBtn}>Cancel</button>
                  <button type="submit" style={S.saveBtn} disabled={saving}>{saving ? 'Saving…' : 'Save Final Score'}</button>
                </div>
                <div style={S.modalNote}>
                  Want to enter player stats?{' '}
                  <a href={`/league-portal/${leagueId}/score/${scoreGame.id}`} style={{ color: '#39FF14' }}>Full box score →</a>
                </div>
              </form>
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section style={S.section}>
              <div style={S.sectionLabel}>Upcoming</div>
              <div style={S.gameList}>
                {upcoming.map(g => <GameRow key={g.id} game={g} onEnterScore={() => { setScoreGame(g); setHomeScore(''); setAwayScore('') }} onCancel={() => cancelGame(g.id)} leagueId={leagueId} />)}
              </div>
            </section>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <section style={S.section}>
              <div style={S.sectionLabel}>Results</div>
              <div style={S.gameList}>
                {[...completed].reverse().map(g => <GameRow key={g.id} game={g} leagueId={leagueId} />)}
              </div>
            </section>
          )}

          {games.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>📅</div>
              <p style={S.emptyText}>No games scheduled yet. Add your first game above.</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function GameRow({ game, onEnterScore, onCancel, leagueId }: { game: GameWithTeams; onEnterScore?: () => void; onCancel?: () => void; leagueId: string }) {
  const d = new Date(game.scheduled_at)
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

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
        {game.status === 'final' && (
          <span style={S.finalBadge}>Final</span>
        )}
        {game.status === 'scheduled' && onEnterScore && (
          <button onClick={onEnterScore} style={S.scoreBtn}>Enter Score</button>
        )}
        {game.status === 'final' && (
          <a href={`/league-portal/${leagueId}/score/${game.id}`} style={S.boxBtn}>Box Score</a>
        )}
        {game.status === 'scheduled' && onCancel && (
          <button onClick={onCancel} style={S.cancelSmBtn}>Cancel</button>
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
  scoreBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 7, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '7px 14px', cursor: 'pointer' },
  boxBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 7, color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 12px', textDecoration: 'none', whiteSpace: 'nowrap' as const },
  cancelSmBtn: { background: 'none', border: '1px solid #2E2E3A', borderRadius: 7, color: '#6A6A82', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
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
}
