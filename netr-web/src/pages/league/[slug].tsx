import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

type League = {
  id: string
  name: string
  slug: string
  sport: string
  season: string | null
  location: string | null
  description: string | null
  logo_url: string | null
  is_active: boolean
}

type Standing = {
  team_id: string
  team_name: string
  color: string
  wins: number
  losses: number
  pts_for: number
  pts_against: number
}

type Team = {
  id: string
  name: string
  color: string
}

type Game = {
  id: string
  home_team_id: string
  away_team_id: string
  scheduled_at: string
  location: string | null
  status: string
  home_score: number | null
  away_score: number | null
  game_type: string | null
}

export default function PublicLeaguePage() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }

  const [league, setLeague] = useState<League | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return

    async function load() {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id, name, slug, sport, season, location, description, logo_url, is_active')
        .eq('slug', slug)
        .single()

      if (!leagueData) { setNotFound(true); setLoading(false); return }
      setLeague(leagueData)

      const [standingsRes, teamsRes, recentRes, upcomingRes] = await Promise.all([
        supabase.from('league_standings').select('*').eq('league_id', leagueData.id).order('wins', { ascending: false }),
        supabase.from('league_teams').select('id, name, color').eq('league_id', leagueData.id),
        supabase.from('league_games').select('*').eq('league_id', leagueData.id).eq('status', 'final').eq('game_type', 'regular').order('scheduled_at', { ascending: false }).limit(8),
        supabase.from('league_games').select('*').eq('league_id', leagueData.id).eq('status', 'scheduled').order('scheduled_at', { ascending: true }).limit(8),
      ])

      setStandings(standingsRes.data ?? [])
      setTeams(teamsRes.data ?? [])
      setRecentGames(recentRes.data ?? [])
      setUpcomingGames(upcomingRes.data ?? [])
      setLoading(false)
    }

    load()
  }, [slug])

  if (loading) return <LoadingScreen />
  if (notFound || !league) return <NotFoundScreen />

  const teamMap: Record<string, Team> = {}
  for (const t of teams) teamMap[t.id] = t

  return (
    <>
      <Head>
        <title>{league.name} — NETR</title>
        <meta name="description" content={`${league.name} standings, schedule, and results — powered by NETR`} />
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        {/* Header */}
        <header style={S.header}>
          <div style={S.headerInner}>
            <div style={S.headerLeft}>
              {league.logo_url && (
                <img src={league.logo_url} alt={league.name} style={S.leagueLogo} />
              )}
              <div>
                <div style={S.sportLabel}>🏀 {league.sport ?? 'Basketball'}</div>
                <h1 style={S.leagueName}>{league.name}</h1>
                <div style={S.metaRow}>
                  {league.season && <span style={S.chip}>{league.season}</span>}
                  {league.location && <span style={S.chip}>📍 {league.location}</span>}
                  <span style={{
                    ...S.chip,
                    background: league.is_active ? 'rgba(57,255,20,0.12)' : 'rgba(106,106,130,0.12)',
                    color: league.is_active ? '#39FF14' : '#6A6A82',
                  }}>
                    {league.is_active ? '● Active' : '● Archived'}
                  </span>
                </div>
              </div>
            </div>
            <a href="https://netrrating.com" style={S.poweredBy}>Powered by NETR</a>
          </div>
        </header>

        <main style={S.main}>
          {/* Standings */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Standings</h2>
            {standings.length === 0 ? (
              <div style={S.empty}>No games played yet.</div>
            ) : (
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: 36 }}>#</th>
                      <th style={{ ...S.th, textAlign: 'left' as const }}>Team</th>
                      <th style={S.th}>W</th>
                      <th style={S.th}>L</th>
                      <th style={S.th}>PCT</th>
                      <th style={{ ...S.th, display: 'none' } as React.CSSProperties} className="hide-mobile">PF</th>
                      <th style={{ ...S.th, display: 'none' } as React.CSSProperties} className="hide-mobile">PA</th>
                      <th style={S.th}>DIFF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const gp = s.wins + s.losses
                      const pct = gp > 0 ? (s.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
                      const diff = s.pts_for - s.pts_against
                      const isFirst = i === 0 && s.wins > 0
                      return (
                        <tr key={s.team_id} style={{ ...S.tr, background: isFirst ? 'rgba(57,255,20,0.04)' : 'transparent' }}>
                          <td style={{ ...S.td, textAlign: 'center' as const, color: '#6A6A82', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>
                            {isFirst ? '🏆' : i + 1}
                          </td>
                          <td style={S.td}>
                            <div style={S.teamCell}>
                              <div style={{ ...S.teamDot, background: s.color, boxShadow: `0 0 6px ${s.color}66` }} />
                              <span style={{ ...S.teamNameStyle, color: isFirst ? '#EEEEF5' : '#C8C8D4' }}>{s.team_name}</span>
                            </div>
                          </td>
                          <td style={{ ...S.td, color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.wins}</td>
                          <td style={{ ...S.td, color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.losses}</td>
                          <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{pct}</td>
                          <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_for}</td>
                          <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_against}</td>
                          <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13, color: diff > 0 ? '#39FF14' : diff < 0 ? '#FF453A' : '#6A6A82' }}>
                            {diff > 0 ? '+' : ''}{diff}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div style={S.twoCol}>
            {/* Recent Results */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>Recent Results</h2>
              {recentGames.length === 0 ? (
                <div style={S.empty}>No results yet.</div>
              ) : (
                <div style={S.gameList}>
                  {recentGames.map(g => {
                    const home = teamMap[g.home_team_id]
                    const away = teamMap[g.away_team_id]
                    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0)
                    return (
                      <div key={g.id} style={S.gameCard}>
                        <div style={S.gameCardDate}>
                          {formatDate(g.scheduled_at)}
                          <span style={S.finalBadge}>Final</span>
                        </div>
                        <div style={S.gameRow}>
                          <div style={{ ...S.gameTeam, flex: 1, textAlign: 'right' as const }}>
                            {home && <div style={{ ...S.teamDot, background: home.color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                            <span style={{ color: homeWon ? '#EEEEF5' : '#6A6A82', fontWeight: homeWon ? 700 : 400 }}>
                              {home?.name ?? '—'}
                            </span>
                          </div>
                          <div style={S.scoreBox}>
                            <span style={{ color: homeWon ? '#39FF14' : '#6A6A82', fontWeight: 900 }}>{g.home_score ?? 0}</span>
                            <span style={S.scoreSep}>–</span>
                            <span style={{ color: !homeWon ? '#39FF14' : '#6A6A82', fontWeight: 900 }}>{g.away_score ?? 0}</span>
                          </div>
                          <div style={{ ...S.gameTeam, flex: 1, textAlign: 'left' as const }}>
                            {away && <div style={{ ...S.teamDot, background: away.color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                            <span style={{ color: !homeWon ? '#EEEEF5' : '#6A6A82', fontWeight: !homeWon ? 700 : 400 }}>
                              {away?.name ?? '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Upcoming Games */}
            <section style={S.section}>
              <h2 style={S.sectionTitle}>Upcoming Games</h2>
              {upcomingGames.length === 0 ? (
                <div style={S.empty}>No upcoming games scheduled.</div>
              ) : (
                <div style={S.gameList}>
                  {upcomingGames.map(g => {
                    const home = teamMap[g.home_team_id]
                    const away = teamMap[g.away_team_id]
                    return (
                      <div key={g.id} style={S.gameCard}>
                        <div style={S.gameCardDate}>
                          {formatDateTime(g.scheduled_at)}
                          {g.location && <span style={S.locationLabel}>📍 {g.location}</span>}
                        </div>
                        <div style={S.gameRow}>
                          <div style={{ ...S.gameTeam, flex: 1, textAlign: 'right' as const }}>
                            {home && <div style={{ ...S.teamDot, background: home.color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                            <span>{home?.name ?? '—'}</span>
                          </div>
                          <div style={S.vsBox}>VS</div>
                          <div style={{ ...S.gameTeam, flex: 1, textAlign: 'left' as const }}>
                            {away && <div style={{ ...S.teamDot, background: away.color, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />}
                            <span>{away?.name ?? '—'}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        </main>

        <footer style={S.footer}>
          <a href="https://netrrating.com" style={S.footerLink}>NETR</a>
          <span style={S.footerSep}>·</span>
          <span>League management & player stats</span>
        </footer>
      </div>
    </>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
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
    <div style={{ minHeight: '100vh', background: '#040406', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5', padding: 24 }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 72, color: '#1C1C26', fontWeight: 900, lineHeight: 1 }}>404</div>
      <div style={{ fontSize: 18, color: '#6A6A82', marginTop: 12 }}>League not found.</div>
      <a href="https://netrrating.com" style={{ color: '#39FF14', fontSize: 14, marginTop: 24, fontFamily: "'DM Mono', monospace", textDecoration: 'none' }}>← netrrating.com</a>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5' },
  header: { background: '#0A0A0E', borderBottom: '1px solid #1C1C26', padding: '24px 24px 20px' },
  headerInner: { maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' as const },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: 16 },
  leagueLogo: { width: 64, height: 64, borderRadius: 10, objectFit: 'cover' as const, border: '1px solid #2A2A38', flexShrink: 0 },
  sportLabel: { fontSize: 12, color: '#6A6A82', marginBottom: 4 },
  leagueName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, lineHeight: 1, marginBottom: 8 },
  metaRow: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  chip: { background: '#1C1C26', color: '#EEEEF5', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontFamily: "'DM Mono', monospace" },
  poweredBy: { color: '#39FF14', fontSize: 11, fontFamily: "'DM Mono', monospace", textDecoration: 'none', whiteSpace: 'nowrap' as const, paddingTop: 4 },
  main: { maxWidth: 900, margin: '0 auto', padding: '32px 16px 48px' },
  section: { marginBottom: 36 },
  sectionTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 14, color: '#EEEEF5' },
  empty: { color: '#6A6A82', fontSize: 14, padding: '20px 0' },
  tableWrap: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'center' as const, fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", fontWeight: 400, padding: '12px 12px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  tr: { borderBottom: '1px solid #14141C' },
  td: { padding: '12px 12px', textAlign: 'center' as const, fontSize: 14 },
  teamCell: { display: 'flex', alignItems: 'center', gap: 8 },
  teamDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  teamNameStyle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 },
  gameList: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  gameCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 10, padding: '14px 16px' },
  gameCardDate: { fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 },
  finalBadge: { background: 'rgba(57,255,20,0.12)', color: '#39FF14', borderRadius: 99, padding: '2px 8px', fontSize: 10, letterSpacing: 0.5 },
  locationLabel: { color: '#6A6A82', fontSize: 11 },
  gameRow: { display: 'flex', alignItems: 'center', gap: 0 },
  gameTeam: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 0.3, color: '#EEEEF5' },
  scoreBox: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0 },
  scoreSep: { color: '#2E2E3A', fontSize: 16 },
  vsBox: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#6A6A82', fontWeight: 700, letterSpacing: 1, padding: '0 12px', flexShrink: 0 },
  footer: { borderTop: '1px solid #1C1C26', padding: '20px 24px', textAlign: 'center' as const, fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerLink: { color: '#39FF14', textDecoration: 'none' },
  footerSep: { color: '#2E2E3A' },
}
