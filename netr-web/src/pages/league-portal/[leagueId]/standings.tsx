import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueDivision } from '../../../lib/supabase'
import { PortalNav } from './index'

type Standing = {
  team_id: string
  team_name: string
  color: string
  wins: number
  losses: number
  pts_for: number
  pts_against: number
  division_id: string | null
}

export default function StandingsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [divisions, setDivisions] = useState<LeagueDivision[]>([])
  const [divFilter, setDivFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, standingsRes, divisionsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_standings').select('*').eq('league_id', leagueId),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)
      setStandings(standingsRes.data ?? [])
      setDivisions(divisionsRes.data ?? [])
      setLoading(false)
    })
  }, [leagueId])

  if (loading || !league) return <LoadingScreen />

  const visibleStandings = divFilter === 'all' ? standings : standings.filter(s => s.division_id === divFilter)
  const totalGames = visibleStandings.reduce((n, s) => n + s.wins + s.losses, 0) / 2

  return (
    <>
      <Head>
        <title>Standings — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="standings" />

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Standings</h1>
              <p style={S.sub}>
                {visibleStandings.length} team{visibleStandings.length !== 1 ? 's' : ''} · {totalGames} game{totalGames !== 1 ? 's' : ''} played
              </p>
            </div>
          </div>

          {/* Division filter tabs */}
          {divisions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {[(league.cross_division_play ?? true) ? { id: 'all', name: 'All Divisions' } : null, ...divisions].filter(Boolean).map(d => (
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

          {visibleStandings.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🏆</div>
              <p style={S.emptyText}>No games played yet. Standings will appear once you enter your first score.</p>
              <a href={`/league-portal/${leagueId}/schedule`} style={S.emptyLink}>Go to Schedule →</a>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 40 }}>#</th>
                    <th style={{ ...S.th, textAlign: 'left' as const }}>Team</th>
                    <th style={S.th}>W</th>
                    <th style={S.th}>L</th>
                    <th style={S.th}>PCT</th>
                    <th style={S.th}>PF</th>
                    <th style={S.th}>PA</th>
                    <th style={S.th}>DIFF</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStandings.map((s, i) => {
                    const gp = s.wins + s.losses
                    const pct = gp > 0 ? (s.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
                    const diff = s.pts_for - s.pts_against
                    const isFirst = i === 0 && s.wins > 0

                    return (
                      <tr key={s.team_id} style={{ ...S.tr, background: isFirst ? 'rgba(57,255,20,0.04)' : 'transparent' }}>
                        <td style={{ ...S.td, textAlign: 'center' as const, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                          {i === 0 && s.wins > 0 ? '🏆' : i + 1}
                        </td>
                        <td style={S.td}>
                          <div style={S.teamCell}>
                            <div style={{ ...S.teamDot, background: s.color, boxShadow: `0 0 6px ${s.color}66` }} />
                            <span style={{ ...S.teamName, color: isFirst ? '#EEEEF5' : '#C8C8D4' }}>{s.team_name}</span>
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
  main: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 16 },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, marginBottom: 4 },
  sub: { color: '#6A6A82', fontSize: 14 },
  empty: { textAlign: 'center' as const, padding: '60px 24px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#6A6A82', fontSize: 15, marginBottom: 16 },
  emptyLink: { color: '#39FF14', fontSize: 14, textDecoration: 'none', fontFamily: "'DM Mono', monospace" },
  tableWrap: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'center' as const, fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", fontWeight: 400, padding: '14px 16px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  tr: { borderBottom: '1px solid #14141C', transition: 'background 0.15s' },
  td: { padding: '14px 16px', textAlign: 'center' as const, fontSize: 14 },
  teamCell: { display: 'flex', alignItems: 'center', gap: 10 },
  teamDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
}
