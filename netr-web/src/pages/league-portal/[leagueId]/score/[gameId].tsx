import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueTeam, LeagueGame, LeaguePlayer, LeaguePlayerStat } from '../../../../lib/supabase'
import { PortalNav } from '../index'
import { STAT_INPUT_COLS, DEFAULT_ENABLED_STATS, StatKey } from '../../../../lib/stat-config'

type NumericStatField = 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks' | 'turnovers' | 'fouls' |
  'three_pointers_made' | 'three_pointers_attempted' | 'field_goals_made' | 'field_goals_attempted' |
  'free_throws_made' | 'free_throws_attempted'

type PlayerStatRow = {
  player: LeaguePlayer
  stat: Partial<LeaguePlayerStat>
}

const EMPTY_STAT: Partial<LeaguePlayerStat> = {
  points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0,
  turnovers: 0, fouls: 0,
  three_pointers_made: 0, three_pointers_attempted: 0,
  field_goals_made: 0, field_goals_attempted: 0,
  free_throws_made: 0, free_throws_attempted: 0,
}

function StatStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={S.stepper}>
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onChange(Math.max(0, value - 1)) }}
        style={S.stepBtn}
      >−</button>
      <input
        type="number"
        min={0}
        max={999}
        value={value}
        onFocus={e => e.target.select()}
        onChange={e => onChange(Math.max(0, parseInt(e.target.value) || 0))}
        style={S.stepInput}
      />
      <button
        type="button"
        onMouseDown={e => { e.preventDefault(); onChange(value + 1) }}
        style={S.stepBtn}
      >+</button>
    </div>
  )
}

export default function BoxScorePage() {
  const router = useRouter()
  const { leagueId, gameId } = router.query as { leagueId: string; gameId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [game, setGame] = useState<LeagueGame | null>(null)
  const [homeTeam, setHomeTeam] = useState<LeagueTeam | null>(null)
  const [awayTeam, setAwayTeam] = useState<LeagueTeam | null>(null)
  const [homeRows, setHomeRows] = useState<PlayerStatRow[]>([])
  const [awayRows, setAwayRows] = useState<PlayerStatRow[]>([])
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [enabledStats, setEnabledStats] = useState<StatKey[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!leagueId || !gameId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, gameRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_games').select('*').eq('id', gameId).single(),
      ])

      if (!leagueRes.data || !gameRes.data) { router.replace(`/league-portal/${leagueId}/schedule`); return }

      const [homeTeamRes, awayTeamRes, homePlayersRes, awayPlayersRes, existingStatsRes] = await Promise.all([
        supabase.from('league_teams').select('*').eq('id', gameRes.data.home_team_id).single(),
        supabase.from('league_teams').select('*').eq('id', gameRes.data.away_team_id).single(),
        supabase.from('league_players').select('*').eq('team_id', gameRes.data.home_team_id).order('display_name'),
        supabase.from('league_players').select('*').eq('team_id', gameRes.data.away_team_id).order('display_name'),
        supabase.from('league_player_stats').select('*').eq('game_id', gameId),
      ])

      const statsById: Record<string, LeaguePlayerStat> = {}
      for (const s of (existingStatsRes.data ?? [])) statsById[s.player_id] = s

      const enabled = (leagueRes.data.enabled_stats ?? DEFAULT_ENABLED_STATS) as StatKey[]
      setEnabledStats(enabled)
      setLeague(leagueRes.data)
      setGame(gameRes.data)
      setHomeTeam(homeTeamRes.data)
      setAwayTeam(awayTeamRes.data)
      setHomeRows((homePlayersRes.data ?? []).map(p => ({ player: p, stat: statsById[p.id] ?? { ...EMPTY_STAT } })))
      setAwayRows((awayPlayersRes.data ?? []).map(p => ({ player: p, stat: statsById[p.id] ?? { ...EMPTY_STAT } })))

      if (gameRes.data.home_score !== null) setHomeScore(String(gameRes.data.home_score))
      if (gameRes.data.away_score !== null) setAwayScore(String(gameRes.data.away_score))

      setLoading(false)
    })
  }, [leagueId, gameId])

  function updateStat(rows: PlayerStatRow[], setRows: (r: PlayerStatRow[]) => void, playerId: string, field: NumericStatField, value: number) {
    setRows(rows.map(r => r.player.id === playerId ? { ...r, stat: { ...r.stat, [field]: value } } : r))
  }

  function getNum(stat: Partial<LeaguePlayerStat>, field: NumericStatField): number {
    return (stat[field] as number | undefined) ?? 0
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await supabase.from('league_games').update({
      home_score: homeScore ? parseInt(homeScore) : null,
      away_score: awayScore ? parseInt(awayScore) : null,
      status: homeScore && awayScore ? 'final' : game?.status,
    }).eq('id', gameId)

    const allRows = [...homeRows, ...awayRows].filter(r => r.player)
    const upserts = allRows.map(r => ({
      game_id: gameId,
      player_id: r.player.id,
      team_id: r.player.team_id,
      points:                   r.stat.points ?? 0,
      rebounds:                 r.stat.rebounds ?? 0,
      assists:                  r.stat.assists ?? 0,
      steals:                   r.stat.steals ?? 0,
      blocks:                   r.stat.blocks ?? 0,
      turnovers:                r.stat.turnovers ?? 0,
      fouls:                    r.stat.fouls ?? 0,
      three_pointers_made:      r.stat.three_pointers_made ?? 0,
      three_pointers_attempted: r.stat.three_pointers_attempted ?? 0,
      field_goals_made:         r.stat.field_goals_made ?? 0,
      field_goals_attempted:    r.stat.field_goals_attempted ?? 0,
      free_throws_made:         r.stat.free_throws_made ?? 0,
      free_throws_attempted:    r.stat.free_throws_attempted ?? 0,
    }))

    if (upserts.length > 0) {
      await supabase.from('league_player_stats').upsert(upserts, { onConflict: 'game_id,player_id' })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (loading || !league || !game) return <LoadingScreen />

  const enabledSet = new Set(enabledStats)
  const visibleCols = STAT_INPUT_COLS.filter(col => col.showWhen.some(k => enabledSet.has(k)))
  const allColLabels = [...visibleCols.map(c => c.label), 'PF']
  const allColFields: NumericStatField[] = [...visibleCols.map(c => c.key as NumericStatField), 'fouls']

  function rowHasData(r: PlayerStatRow) {
    return allColFields.some(f => getNum(r.stat, f) > 0)
  }

  function TeamTable({ team, rows, setRows }: { team: LeagueTeam; rows: PlayerStatRow[]; setRows: (r: PlayerStatRow[]) => void }) {
    const filled = rows.filter(rowHasData).length
    return (
      <div style={S.teamSection}>
        <div style={S.teamHeader}>
          <div style={{ ...S.teamDot, background: team.color, boxShadow: `0 0 8px ${team.color}66` }} />
          <span style={S.teamTitle}>{team.name}</span>
          <span style={S.fillBadge}>
            {filled}/{rows.length} entered
          </span>
        </div>

        {rows.length === 0 ? (
          <div style={S.noPlayers}>
            No players on roster. <a href={`/league-portal/${leagueId}/teams`} style={{ color: '#39FF14' }}>Add players →</a>
          </div>
        ) : (
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.thSticky}>Player</th>
                  {allColLabels.map(c => <th key={c} style={S.th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const hasData = rowHasData(r)
                  return (
                    <tr key={r.player.id} style={{ ...S.tr, ...(hasData ? S.trFilled : {}) }}>
                      <td style={S.tdSticky}>
                        <div style={S.playerCell}>
                          {hasData && <span style={S.doneCheck}>✓</span>}
                          {r.player.jersey_number && <span style={S.jersey}>{r.player.jersey_number}</span>}
                          <span style={S.playerName}>{r.player.display_name}</span>
                        </div>
                      </td>
                      {allColFields.map((field) => (
                        <td key={field} style={S.td}>
                          <StatStepper
                            value={getNum(r.stat, field)}
                            onChange={v => updateStat(rows, setRows, r.player.id, field, v)}
                          />
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Box Score — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="schedule" />

        <form onSubmit={handleSave}>
          <main style={S.main}>
            {/* Game header */}
            <div style={S.gameHeader}>
              <a href={`/league-portal/${leagueId}/schedule`} style={S.backLink}>← Schedule</a>
              <div style={S.matchup}>
                <div style={S.teamBlock}>
                  <div style={{ ...S.teamDotLg, background: homeTeam?.color ?? '#39FF14' }} />
                  <div style={S.teamBlockName}>{homeTeam?.name}</div>
                  <input
                    type="number"
                    min="0"
                    value={homeScore}
                    onFocus={e => e.target.select()}
                    onChange={e => setHomeScore(e.target.value)}
                    style={S.bigScoreInput}
                    placeholder="—"
                  />
                </div>
                <div style={S.finalLabel}>{game.status === 'final' ? 'FINAL' : 'VS'}</div>
                <div style={S.teamBlock}>
                  <div style={{ ...S.teamDotLg, background: awayTeam?.color ?? '#39FF14' }} />
                  <div style={S.teamBlockName}>{awayTeam?.name}</div>
                  <input
                    type="number"
                    min="0"
                    value={awayScore}
                    onFocus={e => e.target.select()}
                    onChange={e => setAwayScore(e.target.value)}
                    style={S.bigScoreInput}
                    placeholder="—"
                  />
                </div>
              </div>
              {game.location && <div style={S.gameLocation}>📍 {game.location}</div>}
            </div>

            {/* Tips bar */}
            <div style={S.tipsBar}>
              <span style={S.tipIcon}>💡</span>
              <span style={S.tipText}>
                Use <strong>+/−</strong> to tap through stats, or click a number and type directly.
                {enabledSet.has('fg%') && ' FG% calculates automatically from FGM/FGA.'}
                {enabledSet.has('3p%') && ' 3P% from 3PM/3PA.'}
                {enabledSet.has('ft%') && ' FT% from FTM/FTA.'}
              </span>
            </div>

            {/* Box scores */}
            {homeTeam && <TeamTable team={homeTeam} rows={homeRows} setRows={setHomeRows} />}
            {awayTeam && <TeamTable team={awayTeam} rows={awayRows} setRows={setAwayRows} />}

            {/* Save bar */}
            <div style={S.saveBar}>
              <a href={`/league-portal/${leagueId}/schedule`} style={S.backBtn}>← Back to Schedule</a>
              <button type="submit" style={{ ...S.saveBtn, ...(saved ? S.saveBtnDone : {}) }} disabled={saving}>
                {saving ? 'Saving…' : saved ? '✓ Saved!' : 'Save Box Score'}
              </button>
            </div>
          </main>
        </form>
      </div>
    </>
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
  main: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px 100px' },

  // Game header
  gameHeader: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 16,
    padding: '28px 32px',
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  backLink: { display: 'block', textAlign: 'left' as const, color: '#6A6A82', fontSize: 13, fontFamily: "'DM Mono', monospace", textDecoration: 'none', marginBottom: 20 },
  matchup: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, marginBottom: 8, flexWrap: 'wrap' as const },
  teamBlock: { textAlign: 'center' as const },
  teamDotLg: { width: 20, height: 20, borderRadius: '50%', margin: '0 auto 8px' },
  teamBlockName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, textTransform: 'uppercase' as const, marginBottom: 10, letterSpacing: 0.5 },
  bigScoreInput: {
    width: 100,
    background: '#0A0A0D',
    border: '2px solid #2E2E3A',
    borderRadius: 10,
    color: '#EEEEF5',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 52,
    fontWeight: 900,
    padding: '8px',
    outline: 'none',
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
  },
  finalLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: '#6A6A82', letterSpacing: 2, marginTop: 36 },
  gameLocation: { fontSize: 13, color: '#6A6A82', marginTop: 8 },

  // Tips bar
  tipsBar: {
    background: 'rgba(57,255,20,0.06)',
    border: '1px solid rgba(57,255,20,0.15)',
    borderRadius: 10,
    padding: '10px 16px',
    marginBottom: 20,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipIcon: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  tipText: { fontSize: 13, color: '#8A9A8A', lineHeight: 1.5 },

  // Team table
  teamSection: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
  teamHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  teamDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  teamTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5, flex: 1 },
  fillBadge: { fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", background: '#14141C', padding: '3px 10px', borderRadius: 99 },
  noPlayers: { padding: 24, color: '#6A6A82', fontSize: 14 },

  // Table
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: 400 },
  th: {
    textAlign: 'center' as const,
    fontSize: 10,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 400,
    padding: '10px 6px',
    borderBottom: '1px solid #1C1C26',
    whiteSpace: 'nowrap' as const,
  },
  thSticky: {
    textAlign: 'left' as const,
    fontSize: 10,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 400,
    padding: '10px 16px',
    borderBottom: '1px solid #1C1C26',
    position: 'sticky' as const,
    left: 0,
    background: '#0F0F14',
    zIndex: 1,
    whiteSpace: 'nowrap' as const,
  },
  tr: { borderBottom: '1px solid #14141C', transition: 'background 0.15s' },
  trFilled: { background: 'rgba(57,255,20,0.03)' },
  td: { padding: '8px 6px', textAlign: 'center' as const, verticalAlign: 'middle' as const },
  tdSticky: {
    padding: '8px 16px',
    position: 'sticky' as const,
    left: 0,
    background: '#0F0F14',
    zIndex: 1,
    borderRight: '1px solid #1C1C26',
  },
  playerCell: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 140 },
  doneCheck: { color: '#39FF14', fontSize: 12, fontFamily: "'DM Mono', monospace", width: 14, flexShrink: 0 },
  jersey: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 11, minWidth: 20, textAlign: 'right' as const, flexShrink: 0 },
  playerName: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const },

  // Stepper
  stepper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  stepBtn: {
    width: 28,
    height: 34,
    background: '#14141C',
    border: '1px solid #2A2A38',
    borderRadius: 6,
    color: '#EEEEF5',
    fontSize: 18,
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontFamily: 'monospace',
    padding: 0,
    userSelect: 'none' as const,
  },
  stepInput: {
    width: 46,
    background: '#0A0A0D',
    border: '1px solid #2A2A38',
    borderRadius: 6,
    color: '#EEEEF5',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 20,
    fontWeight: 700,
    padding: '4px 2px',
    outline: 'none',
    textAlign: 'center' as const,
    boxSizing: 'border-box' as const,
    MozAppearance: 'textfield' as 'none',
  },

  // Save bar
  saveBar: {
    position: 'fixed' as const,
    bottom: 0,
    left: 0,
    right: 0,
    background: '#0A0A0E',
    borderTop: '1px solid #1C1C26',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 40,
  },
  backBtn: { color: '#6A6A82', fontSize: 14, fontFamily: "'DM Mono', monospace", textDecoration: 'none' },
  saveBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    border: 'none',
    borderRadius: 10,
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '12px 36px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveBtnDone: {
    background: 'rgba(57,255,20,0.15)',
    color: '#39FF14',
  },
}
