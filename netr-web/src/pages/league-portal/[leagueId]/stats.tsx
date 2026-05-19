import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeaguePlayer, LeaguePlayerStat, LeagueDivision } from '../../../lib/supabase'
import { PortalNav } from './index'
import {
  STAT_DEFS, DEFAULT_ENABLED_STATS, StatKey,
  AggStat, emptyAgg, getStatValue, fmtStat,
} from '../../../lib/stat-config'
import { NetrBadge } from '../../../components/NetrBadge'

type PlayerRow = {
  playerId: string
  displayName: string
  jerseyNumber: string | null
  teamName: string
  teamColor: string
  gp: number
  agg: AggStat
  netrScore: number | null
}

type RawRow = LeaguePlayerStat & {
  league_players: Pick<LeaguePlayer, 'display_name' | 'jersey_number'> | null
  league_teams: { name: string; color: string } | null
}

export default function StatsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [allRows, setAllRows] = useState<PlayerRow[]>([])
  const [enabledStats, setEnabledStats] = useState<StatKey[]>([])
  const [activeTab, setActiveTab] = useState<StatKey | null>(null)
  const [divisions, setDivisions] = useState<LeagueDivision[]>([])
  const [divFilter, setDivFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, finalGamesRes, divisionsRes, teamsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_games').select('id,division_id').eq('league_id', leagueId).eq('status', 'final'),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
        supabase.from('league_teams').select('id,division_id').eq('league_id', leagueId),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }

      const finalGames = finalGamesRes.data ?? []
      const finalGameIds = finalGames.map(g => g.id)
      const [statsRes, playersRes] = await Promise.all([
        supabase
          .from('league_player_stats')
          .select(`*, league_players!player_id ( display_name, jersey_number ), league_teams!team_id ( name, color )`)
          .in('game_id', finalGameIds.length > 0 ? finalGameIds : ['00000000-0000-0000-0000-000000000000']),
        supabase
          .from('league_players')
          .select('id, profiles ( netr_score )')
          .eq('league_id', leagueId),
      ])
      const netrMap: Record<string, number | null> = {}
      for (const p of (playersRes.data ?? []) as any[]) {
        netrMap[p.id] = p.profiles?.netr_score ?? null
      }

      const enabled = (leagueRes.data.enabled_stats ?? DEFAULT_ENABLED_STATS) as StatKey[]
      setLeague(leagueRes.data)
      setEnabledStats(enabled)
      setActiveTab(enabled[0] ?? null)
      const divs = divisionsRes.data ?? []
      setDivisions(divs)
      if (!(leagueRes.data.cross_division_play ?? true) && divs.length > 0) {
        setDivFilter(divs[0].id)
      }

      // Build game→division and team→division maps for filtering
      const gameDivMap: Record<string, string | null> = {}
      for (const g of finalGames) gameDivMap[g.id] = (g as { id: string; division_id: string | null }).division_id
      const teamDivMap: Record<string, string | null> = {}
      for (const t of (teamsRes.data ?? [])) teamDivMap[t.id] = (t as { id: string; division_id: string | null }).division_id

      // Aggregate per player — store division info per stat line
      type AggRow = PlayerRow & { divisionId: string | null }
      const aggMap: Record<string, AggRow> = {}
      for (const s of (statsRes.data ?? []) as RawRow[]) {
        const pid = s.player_id
        const divId = gameDivMap[s.game_id] ?? teamDivMap[s.team_id] ?? null
        if (!aggMap[pid]) {
          aggMap[pid] = {
            playerId: pid,
            displayName: s.league_players?.display_name ?? '—',
            jerseyNumber: s.league_players?.jersey_number ?? null,
            teamName: s.league_teams?.name ?? '—',
            teamColor: s.league_teams?.color ?? '#6A6A82',
            gp: 0,
            agg: emptyAgg(),
            divisionId: divId,
            netrScore: netrMap[pid] ?? null,
          }
        }
        const r = aggMap[pid]
        r.gp += 1
        r.agg.points                   += s.points ?? 0
        r.agg.rebounds                 += s.rebounds ?? 0
        r.agg.assists                  += s.assists ?? 0
        r.agg.steals                   += s.steals ?? 0
        r.agg.blocks                   += s.blocks ?? 0
        r.agg.turnovers                += s.turnovers ?? 0
        r.agg.three_pointers_made      += s.three_pointers_made ?? 0
        r.agg.three_pointers_attempted += s.three_pointers_attempted ?? 0
        r.agg.field_goals_made         += s.field_goals_made ?? 0
        r.agg.field_goals_attempted    += s.field_goals_attempted ?? 0
        r.agg.free_throws_made         += s.free_throws_made ?? 0
        r.agg.free_throws_attempted    += s.free_throws_attempted ?? 0
      }

      setAllRows(Object.values(aggMap))
      setLoading(false)
    })
  }, [leagueId])

  if (loading || !league) return <LoadingScreen />

  const minGames   = league.min_games_for_stats ?? 1
  const statDisplay = league.stat_display ?? 'per_game'

  const tabDefs   = STAT_DEFS.filter(d => enabledStats.includes(d.key))
  const activeDef = STAT_DEFS.find(d => d.key === activeTab)

  const filteredRows = divFilter === 'all'
    ? allRows
    : allRows.filter(r => (r as PlayerRow & { divisionId: string | null }).divisionId === divFilter)

  const qualified = filteredRows.filter(r => r.gp >= minGames)
  const sorted = activeTab
    ? [...qualified].sort((a, b) => {
        const va = statDisplay === 'totals' ? getStatValue(a.agg, 1, activeTab) : getStatValue(a.agg, a.gp, activeTab)
        const vb = statDisplay === 'totals' ? getStatValue(b.agg, 1, activeTab) : getStatValue(b.agg, b.gp, activeTab)
        return vb - va
      })
    : qualified

  return (
    <>
      <Head>
        <title>Stats — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="stats" />

        <main style={S.main}>
          <div style={S.pageHeader}>
            <h1 style={S.pageTitle}>Stats Leaders</h1>
            <div style={S.pageSub}>{league.name} · Per-game averages</div>
          </div>

          {/* Division filter tabs */}
          {divisions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {[(league.cross_division_play ?? true) ? { id: 'all', name: 'All' } : null, ...divisions].filter(Boolean).map(d => (
                <button
                  key={d.id}
                  onClick={() => setDivFilter(d.id)}
                  style={{
                    background: divFilter === d.id ? 'rgba(57,255,20,0.12)' : '#0F0F14',
                    border: `1.5px solid ${divFilter === d.id ? '#39FF14' : '#1C1C26'}`,
                    borderRadius: 8,
                    color: divFilter === d.id ? '#39FF14' : '#6A6A82',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: 1,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {enabledStats.length === 0 ? (
            <div style={S.empty}>No stat categories enabled. <a href={`/league-portal/${leagueId}`} style={{ color: '#39FF14' }}>Configure stats →</a></div>
          ) : (
            <>
              {/* Stat category tabs */}
              <div style={S.catTabs}>
                {tabDefs.map(def => (
                  <button
                    key={def.key}
                    onClick={() => setActiveTab(def.key)}
                    style={{ ...S.catTab, ...(activeTab === def.key ? S.catTabActive : {}) }}
                  >
                    {def.label}
                  </button>
                ))}
              </div>

              {/* Leaderboard */}
              <div style={S.tableCard}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>{activeDef?.fullLabel ?? ''} Leaders</div>
                  <div style={S.tableNote}>
                  {statDisplay === 'totals' ? 'Season totals' : 'Per-game averages'}
                  {activeDef?.isPercent ? ' (%)' : ''}
                  {minGames > 1 ? ` · min. ${minGames} games` : ''}
                </div>
                </div>

                {sorted.length === 0 ? (
                  <div style={S.noData}>No stats recorded yet. Enter box scores after games to populate the leaderboard.</div>
                ) : (
                  <div style={S.tableWrap}>
                    <table style={S.table}>
                      <thead>
                        <tr>
                          <th style={{ ...S.th, width: 40, textAlign: 'center' as const }}>#</th>
                          <th style={{ ...S.th, textAlign: 'left' as const }}>Player</th>
                          <th style={{ ...S.th, textAlign: 'left' as const }}>Team</th>
                          <th style={{ ...S.th, width: 56 }}>GP</th>
                          <th style={{ ...S.th, width: 80, color: '#EEEEF5' }}>{activeDef?.label}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((r, i) => {
                          const val = activeTab
                            ? (statDisplay === 'totals'
                                ? getStatValue(r.agg, 1, activeTab)
                                : getStatValue(r.agg, r.gp, activeTab))
                            : 0
                          const isTop = i === 0
                          return (
                            <tr key={r.playerId} style={{ ...S.tr, ...(isTop ? S.trTop : {}) }}>
                              <td style={{ ...S.td, textAlign: 'center' as const }}>
                                <span style={{ ...S.rank, ...(isTop ? S.rankTop : {}) }}>
                                  {isTop ? '▲' : i + 1}
                                </span>
                              </td>
                              <td style={S.td}>
                                <div style={S.playerCell}>
                                  {r.jerseyNumber && <span style={S.jersey}>{r.jerseyNumber}</span>}
                                  <span style={S.playerName}>{r.displayName}</span>
                                  <NetrBadge score={r.netrScore} fontSize={11}/>
                                </div>
                              </td>
                              <td style={S.td}>
                                <div style={S.teamCell}>
                                  <div style={{ ...S.teamDot, background: r.teamColor, boxShadow: `0 0 6px ${r.teamColor}55` }} />
                                  <span style={S.teamName}>{r.teamName}</span>
                                </div>
                              </td>
                              <td style={{ ...S.td, textAlign: 'center' as const, color: '#6A6A82' }}>
                                {r.gp}
                              </td>
                              <td style={{ ...S.td, textAlign: 'center' as const }}>
                                <span style={{ ...S.statValue, ...(isTop ? S.statValueTop : {}) }}>
                                  {activeTab ? fmtStat(val, activeTab) : '—'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
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
  main: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' },
  pageHeader: { marginBottom: 28 },
  pageTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 40,
    textTransform: 'uppercase' as const,
    lineHeight: 1,
    marginBottom: 6,
  },
  pageSub: { fontSize: 14, color: '#6A6A82' },
  empty: { color: '#6A6A82', fontSize: 15, padding: '48px 0' },
  catTabs: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 24,
  },
  catTab: {
    background: '#0F0F14',
    border: '1.5px solid #1C1C26',
    borderRadius: 8,
    color: '#6A6A82',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 1,
    padding: '8px 18px',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textTransform: 'uppercase' as const,
  },
  catTabActive: {
    background: 'rgba(57,255,20,0.12)',
    borderColor: '#39FF14',
    color: '#39FF14',
  },
  tableCard: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 14,
    overflow: 'hidden',
  },
  tableHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #1C1C26',
    background: '#0A0A0E',
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  tableTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableNote: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  noData: { padding: '40px 20px', color: '#6A6A82', fontSize: 14 },
  tableWrap: { overflowX: 'auto' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, minWidth: 480 },
  th: {
    fontSize: 10,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    fontFamily: "'DM Mono', monospace",
    fontWeight: 400,
    padding: '10px 12px',
    borderBottom: '1px solid #1C1C26',
    textAlign: 'center' as const,
  },
  tr: { borderBottom: '1px solid #14141C' },
  trTop: { background: 'rgba(57,255,20,0.03)' },
  td: { padding: '12px', textAlign: 'left' as const },
  rank: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    color: '#6A6A82',
  },
  rankTop: { color: '#39FF14', fontSize: 14 },
  playerCell: { display: 'flex', alignItems: 'center', gap: 8 },
  jersey: {
    fontFamily: "'DM Mono', monospace",
    color: '#6A6A82',
    fontSize: 11,
    minWidth: 22,
    textAlign: 'right' as const,
  },
  playerName: { fontSize: 15, fontWeight: 500 },
  teamCell: { display: 'flex', alignItems: 'center', gap: 8 },
  teamDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontSize: 13, color: '#6A6A82' },
  statValue: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    color: '#EEEEF5',
  },
  statValueTop: { color: '#39FF14', fontSize: 24 },
}
