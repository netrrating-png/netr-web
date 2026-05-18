import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../../../lib/supabase'
import type { InsightResult } from '../../../../lib/league-insights'

type League = { id: string; name: string; slug: string; sport: string; season: string | null; accent_color: string | null; logo_url: string | null; league_font: string | null }
type Team = { id: string; name: string; color: string; logo_url: string | null }
type Player = { id: string; display_name: string; jersey_number: string | null; position: string | null; netr_score: number | null }
type Game = { id: string; home_team_id: string; away_team_id: string; scheduled_at: string; location: string | null; status: string; home_score: number | null; away_score: number | null; home_team_name?: string; away_team_name?: string; home_team_color?: string; away_team_color?: string }
type RawStat = { player_id: string; points: number; rebounds: number; assists: number; steals: number; blocks: number; field_goals_made: number; field_goals_attempted: number; three_pointers_made: number; three_pointers_attempted: number; free_throws_made: number; free_throws_attempted: number }
type PStat = { player_id: string; display_name: string; jersey_number: string | null; gp: number; ppg: number; rpg: number; apg: number; spg: number; bpg: number; fgPct: number | null }

function netrColor(s: number): string {
  if (s >= 9.5) return '#C40010'
  if (s >= 9.0) return '#FF3B30'
  if (s >= 8.0) return '#FF7A00'
  if (s >= 7.0) return '#FFC247'
  if (s >= 6.0) return '#39FF14'
  if (s >= 5.0) return '#2ECC71'
  if (s >= 4.0) return '#2DA8FF'
  if (s >= 3.0) return '#7B9FFF'
  return '#9B8BFF'
}

export default function TeamSharePage() {
  const router = useRouter()
  const { slug, teamId } = router.query as { slug: string; teamId: string }

  const [league, setLeague] = useState<League | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [stats, setStats] = useState<PStat[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [insight, setInsight] = useState<InsightResult | null>(null)

  useEffect(() => {
    if (!slug || !teamId) return
    load()
    // Fetch AI insight for this team in the background
    fetch(`/api/league/${slug}/insights`)
      .then(r => r.json())
      .then(d => {
        const found = (d.insights as InsightResult[] ?? []).find(i => i.team_id === teamId)
        if (found) setInsight(found)
      })
      .catch(() => {/* insights are optional */})
  }, [slug, teamId])

  async function load() {
    const leagueRes = await supabase.from('leagues').select('id,name,slug,sport,season,accent_color,logo_url,league_font').eq('slug', slug).single()
    if (!leagueRes.data) { setNotFound(true); setLoading(false); return }
    const lg = leagueRes.data as League

    const [teamRes, playersRes, gamesRes, allTeamsRes] = await Promise.all([
      supabase.from('league_teams').select('id,name,color,logo_url').eq('id', teamId).eq('league_id', lg.id).single(),
      supabase.from('league_players').select('id,display_name,jersey_number,position,netr_score').eq('team_id', teamId).order('display_name'),
      supabase.from('league_games').select('*').eq('league_id', lg.id).or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order('scheduled_at'),
      supabase.from('league_teams').select('id,name,color').eq('league_id', lg.id),
    ])

    if (!teamRes.data) { setNotFound(true); setLoading(false); return }

    const teamMap: Record<string, { name: string; color: string }> = {}
    for (const t of (allTeamsRes.data ?? [])) teamMap[t.id] = { name: t.name, color: t.color }

    const enrichedGames: Game[] = (gamesRes.data ?? []).map(g => ({
      ...g,
      home_team_name: teamMap[g.home_team_id]?.name ?? '',
      away_team_name: teamMap[g.away_team_id]?.name ?? '',
      home_team_color: teamMap[g.home_team_id]?.color ?? '#39FF14',
      away_team_color: teamMap[g.away_team_id]?.color ?? '#39FF14',
    }))

    const playerIds = (playersRes.data ?? []).map(p => p.id)
    let pstats: PStat[] = []
    if (playerIds.length > 0) {
      const statsRes = await supabase.from('league_player_stats').select('*').in('player_id', playerIds)
      const rawStats = (statsRes.data ?? []) as RawStat[]

      const byPlayer: Record<string, RawStat[]> = {}
      for (const s of rawStats) {
        if (!byPlayer[s.player_id]) byPlayer[s.player_id] = []
        byPlayer[s.player_id].push(s)
      }

      pstats = (playersRes.data ?? []).map(p => {
        const rows = byPlayer[p.id] ?? []
        const gp = rows.length
        if (gp === 0) return { player_id: p.id, display_name: p.display_name, jersey_number: p.jersey_number, gp: 0, ppg: 0, rpg: 0, apg: 0, spg: 0, bpg: 0, fgPct: null }
        const sum = (f: keyof RawStat) => rows.reduce((s, r) => s + (r[f] as number), 0)
        const fgm = sum('field_goals_made')
        const fga = sum('field_goals_attempted')
        return {
          player_id: p.id,
          display_name: p.display_name,
          jersey_number: p.jersey_number,
          gp,
          ppg: sum('points') / gp,
          rpg: sum('rebounds') / gp,
          apg: sum('assists') / gp,
          spg: sum('steals') / gp,
          bpg: sum('blocks') / gp,
          fgPct: fga > 0 ? fgm / fga : null,
        }
      }).sort((a, b) => b.ppg - a.ppg)
    }

    setLeague(lg)
    setTeam(teamRes.data as Team)
    setPlayers((playersRes.data ?? []) as Player[])
    setGames(enrichedGames)
    setStats(pstats)
    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (notFound || !league || !team) return <NotFoundScreen />

  const accent = league.accent_color ?? '#39FF14'
  const finalGames = games.filter(g => g.status === 'final')
  const wins = finalGames.filter(g => {
    const isHome = g.home_team_id === teamId
    return isHome ? (g.home_score ?? 0) > (g.away_score ?? 0) : (g.away_score ?? 0) > (g.home_score ?? 0)
  }).length
  const losses = finalGames.length - wins
  const upcoming = games.filter(g => g.status === 'scheduled').sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const recentResults = [...finalGames].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)).slice(0, 5)

  function shareUrl() {
    if (typeof window === 'undefined') return ''
    return window.location.href
  }

  function copyLink() {
    navigator.clipboard.writeText(shareUrl()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function fmtTime(d: string) {
    return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return (
    <>
      <Head>
        <title>{team.name} — {league.name}</title>
        <meta name="description" content={`${team.name} roster, stats, and schedule — ${league.name}${league.season ? ` ${league.season}` : ''}`} />
        <meta property="og:title" content={`${team.name} — ${league.name}`} />
        <meta property="og:description" content={`${wins}W–${losses}L · ${players.length} players · ${league.sport}`} />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#040406', color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif" }}>
        {/* Hero banner */}
        <div style={{ ...S.hero, borderBottomColor: `${accent}44` }}>
          <div style={S.heroInner}>
            {/* League back link */}
            <a href={`/league/${slug}`} style={S.leagueLink}>
              {league.logo_url && <img src={league.logo_url} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />}
              {league.name}
            </a>

            <div style={S.teamHero}>
              {/* Team color circle / logo */}
              {team.logo_url ? (
                <img src={team.logo_url} alt={team.name} style={{ ...S.teamLogo, border: `3px solid ${team.color}` }} />
              ) : (
                <div style={{ ...S.teamColorCircle, background: team.color, boxShadow: `0 0 40px ${team.color}55` }} />
              )}
              <div>
                <h1 style={{ ...S.teamName, color: '#EEEEF5' }}>{team.name}</h1>
                <div style={S.teamMeta}>
                  <span style={S.metaChip}>{league.sport}</span>
                  {league.season && <span style={S.metaChip}>{league.season}</span>}
                  <span style={{ ...S.metaChip, background: `${accent}18`, border: `1px solid ${accent}44`, color: accent }}>
                    {wins}W – {losses}L
                  </span>
                </div>
              </div>
            </div>

            {/* Share button */}
            <button onClick={copyLink} style={{ ...S.shareBtn, borderColor: copied ? `${accent}88` : '#2E2E3A', color: copied ? accent : '#EEEEF5' }}>
              {copied ? '✓ Link Copied!' : '🔗 Share Team Page'}
            </button>
          </div>
        </div>

        <div style={S.main}>
          {/* Record & quick stats */}
          <div style={S.statsRow}>
            {[
              { label: 'Record', value: `${wins}–${losses}` },
              { label: 'Players', value: String(players.length) },
              { label: 'Games Played', value: String(finalGames.length) },
              { label: 'Upcoming', value: String(upcoming.length) },
            ].map(s => (
              <div key={s.label} style={S.statCard}>
                <div style={{ ...S.statVal, color: accent }}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* AI Insight Card */}
          {insight && (() => {
            const trendColor = insight.trend === 'UP' ? '#39FF14' : insight.trend === 'DOWN' ? '#FF453A' : '#6A6A82'
            const trendIcon  = insight.trend === 'UP' ? '↑' : insight.trend === 'DOWN' ? '↓' : '→'
            const isElim     = insight.magic_number === null && insight.games_played > 0
            const isClinched = insight.magic_number === 0
            const playoffPct  = Math.round(insight.playoff_probability * 100)
            const champPct    = Math.round(insight.championship_probability * 100)
            return (
              <div style={{ position: 'relative', overflow: 'hidden', background: '#0D0D12', border: `1px solid ${isElim ? '#1A1A28' : isClinched ? `${accent}44` : `${team.color}44`}`, borderRadius: 16, marginBottom: 24 }}>
                <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg,${team.color}08 0%,transparent 60%)`, pointerEvents: 'none' }} />
                {/* Header */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${team.color}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}`, animation: 'none' }} />
                    <span style={{ fontSize: 9, color: accent, fontFamily: "'DM Mono', monospace", letterSpacing: 3, textTransform: 'uppercase' as const }}>AI Insight</span>
                    {isClinched && <span style={{ fontSize: 9, background: `${accent}20`, border: `1px solid ${accent}44`, color: accent, fontFamily: "'DM Mono', monospace", letterSpacing: 2, padding: '2px 7px', borderRadius: 99 }}>CLINCHED</span>}
                    {isElim    && <span style={{ fontSize: 9, background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.3)', color: '#FF453A', fontFamily: "'DM Mono', monospace", letterSpacing: 2, padding: '2px 7px', borderRadius: 99 }}>ELIMINATED</span>}
                  </div>
                  <span style={{ fontSize: 12, color: trendColor, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{trendIcon} {insight.trend}</span>
                </div>
                {/* Probabilities */}
                <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                  {[
                    { label: 'Playoff Odds', pct: playoffPct, color: team.color },
                    { label: 'Championship', pct: champPct,  color: accent, border: true },
                  ].map(({ label, pct, color, border }) => (
                    <div key={label} style={{ padding: '18px 20px', borderLeft: border ? `1px solid rgba(255,255,255,0.05)` : undefined }}>
                      <div style={{ fontSize: 9, color: '#6A6A82', fontFamily: "'DM Mono', monospace", letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 6 }}>{label}</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 42, color: isElim ? '#2E2E3A' : color, lineHeight: 1, marginBottom: 8 }}>{pct}%</div>
                      <div style={{ height: 4, background: '#1A1A28', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: isElim ? '#2E2E3A' : color, borderRadius: 2 }} />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Magic number + insight text */}
                <div style={{ position: 'relative', padding: '16px 20px' }}>
                  {insight.magic_number !== null && insight.magic_number > 0 && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: `${team.color}12`, border: `1px solid ${team.color}30`, borderRadius: 8, padding: '5px 12px', marginBottom: 12 }}>
                      <span style={{ fontSize: 9, color: '#6A6A82', fontFamily: "'DM Mono', monospace", letterSpacing: 2 }}>MAGIC #</span>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: team.color, lineHeight: 1 }}>{insight.magic_number}</span>
                    </div>
                  )}
                  <p style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(238,238,245,0.85)', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>{insight.insight_text}</p>
                </div>
              </div>
            )
          })()}

          <div style={S.twoCol}>
            {/* Roster */}
            <div style={S.card}>
              <div style={S.cardHeader}>
                <span style={S.cardTitle}>Roster</span>
                <span style={S.cardMeta}>{players.length} player{players.length !== 1 ? 's' : ''}</span>
              </div>
              {players.length === 0 ? (
                <div style={S.empty}>No players on roster yet.</div>
              ) : (
                players.map(p => {
                  const pStat = stats.find(s => s.player_id === p.id)
                  return (
                    <div key={p.id} style={S.rosterRow}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                        {p.jersey_number && <span style={S.jersey}>{p.jersey_number}</span>}
                        <div>
                          <div style={S.playerName}>{p.display_name}</div>
                          {p.position && <div style={S.position}>{p.position}</div>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {pStat && pStat.gp > 0 && (
                          <div style={S.miniStats}>
                            <span style={S.miniStat}>{pStat.ppg.toFixed(1)} PPG</span>
                            <span style={S.miniStat}>{pStat.rpg.toFixed(1)} RPG</span>
                            <span style={S.miniStat}>{pStat.apg.toFixed(1)} APG</span>
                          </div>
                        )}
                        {p.netr_score !== null && (
                          <div style={{ ...S.netrBadge, background: `${netrColor(p.netr_score)}22`, color: netrColor(p.netr_score), border: `1px solid ${netrColor(p.netr_score)}55` }}>
                            {p.netr_score.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Upcoming games */}
              {upcoming.length > 0 && (
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={S.cardTitle}>Upcoming Games</span>
                    <span style={S.cardMeta}>{upcoming.length} game{upcoming.length !== 1 ? 's' : ''}</span>
                  </div>
                  {upcoming.slice(0, 5).map(g => {
                    const isHome = g.home_team_id === teamId
                    const opp = isHome ? g.away_team_name : g.home_team_name
                    const oppColor = isHome ? g.away_team_color : g.home_team_color
                    return (
                      <div key={g.id} style={S.gameRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: oppColor, flexShrink: 0 }} />
                          <div>
                            <div style={S.gameMatchup}>
                              <span style={{ color: '#6A6A82', fontSize: 11 }}>{isHome ? 'vs' : '@'}</span> {opp}
                            </div>
                            <div style={S.gameDate}>{fmtDate(g.scheduled_at)} · {fmtTime(g.scheduled_at)}{g.location ? ` · ${g.location}` : ''}</div>
                          </div>
                        </div>
                        <div style={{ ...S.statusBadge, background: 'rgba(245,197,66,0.1)', color: '#F5C542', border: '1px solid rgba(245,197,66,0.3)' }}>Upcoming</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Recent results */}
              {recentResults.length > 0 && (
                <div style={S.card}>
                  <div style={S.cardHeader}>
                    <span style={S.cardTitle}>Recent Results</span>
                  </div>
                  {recentResults.map(g => {
                    const isHome = g.home_team_id === teamId
                    const opp = isHome ? g.away_team_name : g.home_team_name
                    const oppColor = isHome ? g.away_team_color : g.home_team_color
                    const myScore = isHome ? g.home_score : g.away_score
                    const theirScore = isHome ? g.away_score : g.home_score
                    const won = (myScore ?? 0) > (theirScore ?? 0)
                    return (
                      <div key={g.id} style={S.gameRow}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: oppColor, flexShrink: 0 }} />
                          <div>
                            <div style={S.gameMatchup}>
                              <span style={{ color: '#6A6A82', fontSize: 11 }}>{isHome ? 'vs' : '@'}</span> {opp}
                            </div>
                            <div style={S.gameDate}>{fmtDate(g.scheduled_at)}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ ...S.score, color: won ? accent : '#FF453A' }}>{myScore}–{theirScore}</div>
                          <div style={{ ...S.statusBadge, background: won ? `${accent}15` : 'rgba(255,69,58,0.1)', color: won ? accent : '#FF453A', border: `1px solid ${won ? accent : '#FF453A'}44` }}>
                            {won ? 'W' : 'L'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Stats leaders */}
          {stats.some(s => s.gp > 0) && (
            <div style={{ ...S.card, marginTop: 20 }}>
              <div style={S.cardHeader}>
                <span style={S.cardTitle}>Season Stats</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr>
                      {['Player', 'GP', 'PPG', 'RPG', 'APG', 'SPG', 'BPG', 'FG%'].map(h => (
                        <th key={h} style={{ ...S.th, textAlign: h === 'Player' ? 'left' : 'center' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.filter(s => s.gp > 0).map((s, i) => (
                      <tr key={s.player_id} style={{ borderBottom: '1px solid #14141C', background: i % 2 === 0 ? 'transparent' : '#0A0A0D' }}>
                        <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 500 }}>
                          {s.jersey_number && <span style={{ fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 11, marginRight: 6 }}>#{s.jersey_number}</span>}
                          {s.display_name}
                        </td>
                        {[s.gp, s.ppg, s.rpg, s.apg, s.spg, s.bpg].map((v, vi) => (
                          <td key={vi} style={{ padding: '10px 8px', textAlign: 'center', fontSize: 14, fontFamily: "'DM Mono', monospace", color: vi === 0 ? '#6A6A82' : '#EEEEF5' }}>
                            {vi === 0 ? v : (v as number).toFixed(1)}
                          </td>
                        ))}
                        <td style={{ padding: '10px 8px', textAlign: 'center', fontSize: 14, fontFamily: "'DM Mono', monospace", color: '#6A6A82' }}>
                          {s.fgPct !== null ? `${(s.fgPct * 100).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={S.footer}>
            <a href={`/league/${slug}`} style={{ color: '#6A6A82', textDecoration: 'none' }}>
              ← Back to {league.name}
            </a>
            <a href="/" style={{ color: '#39FF14', textDecoration: 'none', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>
              NETR LEAGUES
            </a>
          </div>
        </div>
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

function NotFoundScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#040406', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: '#FF453A', letterSpacing: 2 }}>TEAM NOT FOUND</div>
      <a href="/" style={{ color: '#39FF14', fontFamily: "'DM Mono', monospace", fontSize: 14 }}>← Go Home</a>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  hero: {
    background: 'linear-gradient(180deg, #0A0A0E 0%, #040406 100%)',
    borderBottom: '1px solid',
    padding: '24px 0 28px',
  },
  heroInner: { maxWidth: 900, margin: '0 auto', padding: '0 24px' },
  leagueLink: {
    display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
    color: '#6A6A82', textDecoration: 'none', fontSize: 13, fontFamily: "'DM Mono', monospace",
  },
  teamHero: { display: 'flex', alignItems: 'center', gap: 20, marginBottom: 20, flexWrap: 'wrap' as const },
  teamLogo: { width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' },
  teamColorCircle: { width: 72, height: 72, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 42, letterSpacing: 1, textTransform: 'uppercase', margin: 0 },
  teamMeta: { display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' as const },
  metaChip: { fontSize: 12, background: '#14141C', border: '1px solid #2E2E3A', borderRadius: 99, padding: '3px 10px', color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  shareBtn: {
    background: 'transparent', border: '1px solid', borderRadius: 8,
    fontSize: 13, fontFamily: "'DM Mono', monospace", padding: '9px 16px', cursor: 'pointer',
    transition: 'all 0.2s',
  },

  main: { maxWidth: 900, margin: '0 auto', padding: '28px 24px 60px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, padding: '16px 14px', textAlign: 'center' as const },
  statVal: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, lineHeight: 1 },
  statLabel: { fontSize: 11, color: '#6A6A82', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' },

  card: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, overflow: 'hidden' },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  cardTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  cardMeta: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },

  rosterRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #14141C' },
  jersey: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 13, minWidth: 24, textAlign: 'right' as const },
  playerName: { fontSize: 14, fontWeight: 500 },
  position: { fontSize: 11, color: '#6A6A82', marginTop: 1 },
  miniStats: { display: 'flex', gap: 6 },
  miniStat: { fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  netrBadge: { fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, padding: '3px 8px', borderRadius: 6 },

  gameRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderBottom: '1px solid #14141C' },
  gameMatchup: { fontSize: 14, fontWeight: 500 },
  gameDate: { fontSize: 12, color: '#6A6A82', marginTop: 2 },
  score: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20 },
  statusBadge: { fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '3px 9px', borderRadius: 99 },

  th: { fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 1.5, fontFamily: "'DM Mono', monospace", fontWeight: 400, padding: '10px 8px', borderBottom: '1px solid #1C1C26' },

  empty: { padding: '20px 18px', color: '#6A6A82', fontSize: 14 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40, padding: '20px 0', borderTop: '1px solid #14141C' },
}
