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
  banner_url: string | null
  accent_color: string | null
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

type Team = { id: string; name: string; color: string }

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

type PlayerStat = {
  player_id: string
  display_name: string
  team_name: string
  team_color: string
  games: number
  ppg: number
  rpg: number
  apg: number
}

const DEFAULT_ACCENT = '#39FF14'

export default function PublicLeaguePage() {
  const router = useRouter()
  const { slug } = router.query as { slug: string }

  const [league, setLeague]           = useState<League | null>(null)
  const [standings, setStandings]     = useState<Standing[]>([])
  const [teams, setTeams]             = useState<Team[]>([])
  const [recentGames, setRecentGames] = useState<Game[]>([])
  const [upcomingGames, setUpcomingGames] = useState<Game[]>([])
  const [statLeaders, setStatLeaders] = useState<PlayerStat[]>([])
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!slug) return
    load()
  }, [slug])

  async function load() {
    const { data: lg } = await supabase
      .from('leagues')
      .select('id, name, slug, sport, season, location, description, logo_url, banner_url, accent_color, is_active')
      .eq('slug', slug)
      .single()

    if (!lg) { setNotFound(true); setLoading(false); return }
    setLeague(lg)

    const [standingsRes, teamsRes, recentRes, upcomingRes, playersRes] = await Promise.all([
      supabase.from('league_standings').select('*').eq('league_id', lg.id).order('wins', { ascending: false }),
      supabase.from('league_teams').select('id, name, color').eq('league_id', lg.id),
      supabase.from('league_games').select('*').eq('league_id', lg.id).eq('status', 'final').eq('game_type', 'regular').order('scheduled_at', { ascending: false }).limit(8),
      supabase.from('league_games').select('*').eq('league_id', lg.id).eq('status', 'scheduled').order('scheduled_at', { ascending: true }).limit(8),
      supabase.from('league_players').select('id, display_name, team_id').eq('league_id', lg.id),
    ])

    setStandings(standingsRes.data ?? [])
    setTeams(teamsRes.data ?? [])
    setRecentGames(recentRes.data ?? [])
    setUpcomingGames(upcomingRes.data ?? [])

    const players = playersRes.data ?? []
    const teamList = teamsRes.data ?? []
    if (players.length > 0) {
      const { data: rawStats } = await supabase
        .from('league_player_stats')
        .select('player_id, points, rebounds, assists')
        .in('player_id', players.map(p => p.id))

      if (rawStats && rawStats.length > 0) {
        const teamMap: Record<string, Team> = {}
        for (const t of teamList) teamMap[t.id] = t

        const agg: Record<string, { name: string; teamName: string; teamColor: string; pts: number; reb: number; ast: number; gp: number }> = {}
        for (const s of rawStats) {
          if (!agg[s.player_id]) {
            const p = players.find(x => x.id === s.player_id)
            const t = p ? teamMap[p.team_id] : null
            agg[s.player_id] = { name: p?.display_name ?? '—', teamName: t?.name ?? '—', teamColor: t?.color ?? '#6A6A82', pts: 0, reb: 0, ast: 0, gp: 0 }
          }
          agg[s.player_id].pts += s.points ?? 0
          agg[s.player_id].reb += s.rebounds ?? 0
          agg[s.player_id].ast += s.assists ?? 0
          agg[s.player_id].gp++
        }

        const leaders: PlayerStat[] = Object.entries(agg)
          .filter(([, v]) => v.gp >= 1)
          .map(([id, v]) => ({
            player_id: id,
            display_name: v.name,
            team_name: v.teamName,
            team_color: v.teamColor,
            games: v.gp,
            ppg: Math.round((v.pts / v.gp) * 10) / 10,
            rpg: Math.round((v.reb / v.gp) * 10) / 10,
            apg: Math.round((v.ast / v.gp) * 10) / 10,
          }))
        setStatLeaders(leaders)
      }
    }

    setLoading(false)
  }

  if (loading) return <LoadingScreen />
  if (notFound || !league) return <NotFoundScreen />

  const accent = league.accent_color || DEFAULT_ACCENT
  const teamMap: Record<string, Team> = {}
  for (const t of teams) teamMap[t.id] = t

  const topScorers  = [...statLeaders].sort((a, b) => b.ppg - a.ppg).slice(0, 5)
  const topRebounds = [...statLeaders].sort((a, b) => b.rpg - a.rpg).slice(0, 5)
  const topAssists  = [...statLeaders].sort((a, b) => b.apg - a.apg).slice(0, 5)

  return (
    <>
      <Head>
        <title>{league.name}</title>
        <meta name="description" content={`${league.name} — standings, schedule, stats${league.season ? ` · ${league.season}` : ''}${league.location ? ` · ${league.location}` : ''}`} />
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={{ minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5' }}>

        {/* ── Hero / Header ── */}
        <div style={{ position: 'relative' as const, background: league.banner_url ? 'transparent' : '#0A0A0E' }}>
          {league.banner_url && (
            <>
              <img
                src={league.banner_url}
                alt=""
                style={{ width: '100%', height: 240, objectFit: 'cover', display: 'block' }}
              />
              <div style={{ position: 'absolute' as const, inset: 0, background: 'linear-gradient(to bottom, rgba(4,4,6,0.3) 0%, rgba(4,4,6,0.85) 100%)' }} />
            </>
          )}
          <div style={{
            position: league.banner_url ? 'absolute' as const : 'relative' as const,
            bottom: 0, left: 0, right: 0,
            padding: '28px 24px 24px',
          }}>
            <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 20 }}>
              {league.logo_url && (
                <img
                  src={league.logo_url}
                  alt={league.name}
                  style={{ width: 88, height: 88, borderRadius: 14, objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0, background: '#0A0A0E' }}
                />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 'clamp(28px, 6vw, 52px)', textTransform: 'uppercase', lineHeight: 1, marginBottom: 10, textShadow: league.banner_url ? '0 2px 12px rgba(0,0,0,0.6)' : 'none' }}>
                  {league.name}
                </h1>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                  {league.season && <span style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', color: '#EEEEF5', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontFamily: "'DM Mono', monospace" }}>{league.season}</span>}
                  {league.location && <span style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', color: '#EEEEF5', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontFamily: "'DM Mono', monospace" }}>📍 {league.location}</span>}
                  <span style={{ background: league.is_active ? `${accent}20` : 'rgba(106,106,130,0.12)', color: league.is_active ? accent : '#6A6A82', fontSize: 12, padding: '4px 10px', borderRadius: 99, fontFamily: "'DM Mono', monospace", border: `1px solid ${league.is_active ? `${accent}40` : 'transparent'}` }}>
                    {league.is_active ? '● Active' : '○ Archived'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* Bottom border accent line */}
          <div style={{ height: 3, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
        </div>

        <main style={{ maxWidth: 900, margin: '0 auto', padding: '36px 16px 64px' }}>

          {/* ── Standings ── */}
          <section style={{ marginBottom: 40 }}>
            <SectionTitle accent={accent}>Standings</SectionTitle>
            {standings.length === 0 ? (
              <Empty>No games played yet.</Empty>
            ) : (
              <div style={{ background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' as const }}>
                  <thead>
                    <tr style={{ background: '#0A0A0E', borderBottom: '1px solid #1C1C26' }}>
                      <th style={TH}>#</th>
                      <th style={{ ...TH, textAlign: 'left' as const }}>Team</th>
                      <th style={TH}>W</th>
                      <th style={TH}>L</th>
                      <th style={TH}>PCT</th>
                      <th style={TH}>PF</th>
                      <th style={TH}>PA</th>
                      <th style={TH}>DIFF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, i) => {
                      const gp = s.wins + s.losses
                      const pct = gp > 0 ? (s.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
                      const diff = s.pts_for - s.pts_against
                      const isFirst = i === 0 && s.wins > 0
                      return (
                        <tr key={s.team_id} style={{ borderBottom: '1px solid #14141C', background: isFirst ? `${accent}08` : 'transparent' }}>
                          <td style={{ ...TD, color: '#6A6A82', fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{isFirst ? '🏆' : i + 1}</td>
                          <td style={TD}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}66`, flexShrink: 0 }} />
                              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 0.3, color: isFirst ? '#EEEEF5' : '#C8C8D4' }}>{s.team_name}</span>
                            </div>
                          </td>
                          <td style={{ ...TD, color: accent, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.wins}</td>
                          <td style={{ ...TD, color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.losses}</td>
                          <td style={{ ...TD, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{pct}</td>
                          <td style={{ ...TD, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_for}</td>
                          <td style={{ ...TD, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_against}</td>
                          <td style={{ ...TD, fontFamily: "'DM Mono', monospace", fontSize: 13, color: diff > 0 ? accent : diff < 0 ? '#FF453A' : '#6A6A82' }}>
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

          {/* ── Stats Leaders ── */}
          {statLeaders.length > 0 && (
            <section style={{ marginBottom: 40 }}>
              <SectionTitle accent={accent}>Stats Leaders</SectionTitle>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                <StatLeaderCard title="Points" unit="PPG" leaders={topScorers} getValue={p => p.ppg} accent={accent} />
                <StatLeaderCard title="Rebounds" unit="RPG" leaders={topRebounds} getValue={p => p.rpg} accent={accent} />
                <StatLeaderCard title="Assists" unit="APG" leaders={topAssists} getValue={p => p.apg} accent={accent} />
              </div>
            </section>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            {/* ── Recent Results ── */}
            <section>
              <SectionTitle accent={accent}>Recent Results</SectionTitle>
              {recentGames.length === 0 ? (
                <Empty>No results yet.</Empty>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {recentGames.map(g => {
                    const home = teamMap[g.home_team_id]
                    const away = teamMap[g.away_team_id]
                    const homeWon = (g.home_score ?? 0) > (g.away_score ?? 0)
                    return (
                      <div key={g.id} style={{ background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                          {fmtDate(g.scheduled_at)}
                          <span style={{ background: `${accent}20`, color: accent, borderRadius: 99, padding: '2px 8px', fontSize: 10, letterSpacing: 0.5, border: `1px solid ${accent}40` }}>Final</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ flex: 1, textAlign: 'right' as const, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, color: homeWon ? '#EEEEF5' : '#6A6A82' }}>
                            {home && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: home.color, marginRight: 6, verticalAlign: 'middle' }} />}
                            {home?.name ?? '—'}
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', flexShrink: 0 }}>
                            <span style={{ color: homeWon ? accent : '#6A6A82' }}>{g.home_score ?? 0}</span>
                            <span style={{ color: '#2E2E3A', fontSize: 16 }}>–</span>
                            <span style={{ color: !homeWon ? accent : '#6A6A82' }}>{g.away_score ?? 0}</span>
                          </div>
                          <div style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, color: !homeWon ? '#EEEEF5' : '#6A6A82' }}>
                            {away && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: away.color, marginRight: 6, verticalAlign: 'middle' }} />}
                            {away?.name ?? '—'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── Upcoming Games ── */}
            <section>
              <SectionTitle accent={accent}>Upcoming Games</SectionTitle>
              {upcomingGames.length === 0 ? (
                <Empty>No upcoming games scheduled.</Empty>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {upcomingGames.map(g => {
                    const home = teamMap[g.home_team_id]
                    const away = teamMap[g.away_team_id]
                    return (
                      <div key={g.id} style={{ background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
                          {fmtDateTime(g.scheduled_at)}
                          {g.location && <span>📍 {g.location}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ flex: 1, textAlign: 'right' as const, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const }}>
                            {home && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: home.color, marginRight: 6, verticalAlign: 'middle' }} />}
                            {home?.name ?? '—'}
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#6A6A82', fontWeight: 700, letterSpacing: 1, padding: '0 12px', flexShrink: 0 }}>VS</div>
                          <div style={{ flex: 1, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const }}>
                            {away && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: away.color, marginRight: 6, verticalAlign: 'middle' }} />}
                            {away?.name ?? '—'}
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

        <footer style={{ borderTop: '1px solid #1C1C26', padding: '20px 24px', textAlign: 'center' as const, fontSize: 11, color: '#3A3A4E', fontFamily: "'DM Mono', monospace" }}>
          Powered by <a href="https://netrrating.com" style={{ color: '#4A4A5E', textDecoration: 'none' }}>NETR</a>
        </footer>
      </div>
    </>
  )
}

function SectionTitle({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 14, color: '#EEEEF5', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ display: 'inline-block', width: 4, height: 20, background: accent, borderRadius: 2, flexShrink: 0 }} />
      {children}
    </h2>
  )
}

function StatLeaderCard({ title, unit, leaders, getValue, accent }: {
  title: string
  unit: string
  leaders: PlayerStat[]
  getValue: (p: PlayerStat) => number
  accent: string
}) {
  return (
    <div style={{ background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1C1C26', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{title}</span>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: accent, letterSpacing: 1 }}>{unit}</span>
      </div>
      {leaders.map((p, i) => (
        <div key={p.player_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: i < leaders.length - 1 ? '1px solid #0D0D12' : 'none', background: i === 0 ? `${accent}06` : 'transparent' }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: i === 0 ? accent : '#3A3A4E', width: 16, textAlign: 'center' as const, flexShrink: 0 }}>{i + 1}</span>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.team_color, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, color: i === 0 ? '#EEEEF5' : '#C8C8D4' }}>{p.display_name}</div>
            <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>{p.team_name} · {p.games}G</div>
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: i === 0 ? 22 : 18, color: i === 0 ? accent : '#EEEEF5', flexShrink: 0 }}>
            {getValue(p)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#6A6A82', fontSize: 14, padding: '20px 0' }}>{children}</div>
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
function fmtDateTime(iso: string) {
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

const TH: React.CSSProperties = { textAlign: 'center', fontSize: 10, color: '#6A6A82', textTransform: 'uppercase', letterSpacing: 2, fontFamily: "'DM Mono', monospace", fontWeight: 400, padding: '12px 10px' }
const TD: React.CSSProperties = { padding: '12px 10px', textAlign: 'center', fontSize: 14 }
