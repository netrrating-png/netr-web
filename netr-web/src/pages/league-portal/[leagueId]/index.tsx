import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueTeam, LeagueGame } from '../../../lib/supabase'
export default function LeagueOverview() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [games, setGames] = useState<LeagueGame[]>([])
  const [playerCount, setPlayerCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, gamesRes, playersRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId),
        supabase.from('league_games').select('*').eq('league_id', leagueId).order('scheduled_at'),
        supabase.from('league_players').select('id', { count: 'exact', head: true }).eq('league_id', leagueId),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)
      setTeams(teamsRes.data ?? [])
      setGames(gamesRes.data ?? [])
      setPlayerCount(playersRes.count ?? 0)
      setLoading(false)
    })
  }, [leagueId])

  if (loading || !league) return <LoadingScreen />

  const now = new Date()
  const gamesPlayed = games.filter(g => g.status === 'final').length
  const upcoming = games.filter(g => g.status === 'scheduled')
  const upcomingCount = upcoming.length
  const paidTeams = teams.filter(t => t.fee_paid).length

  // Action items
  const gamesNeedingScore = games.filter(g =>
    g.status === 'scheduled' && new Date(g.scheduled_at) < now
  )
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
  const gamesThisWeek = upcoming.filter(g => {
    const d = new Date(g.scheduled_at)
    return d >= now && d <= weekEnd
  })
  const unpaidTeams = league.fee_amount ? teams.filter(t => !t.fee_paid) : []
  const hasActions = gamesNeedingScore.length > 0 || gamesThisWeek.length > 0 || unpaidTeams.length > 0

  return (
    <>
      <Head>
        <title>{league.name} — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="overview" logoUrl={league.logo_url} />

        <main style={S.main}>
          {/* League header */}
          <div style={S.leagueHeader}>
            <div>
              <div style={S.sport}>🏀 Basketball</div>
              <h1 style={S.leagueName}>{league.name}</h1>
              <div style={S.meta}>
                {league.season && <span style={S.chip}>{league.season}</span>}
                {league.location && <span style={S.chip}>📍 {league.location}</span>}
              </div>
            </div>
            <span style={{ ...S.statusBadge, background: league.is_active ? 'rgba(57,255,20,0.12)' : 'rgba(106,106,130,0.15)', color: league.is_active ? '#39FF14' : '#6A6A82' }}>
              {league.is_active ? '● Active' : '● Archived'}
            </span>
          </div>

          {/* Action Items */}
          {hasActions && (
            <div style={S.actionCard}>
              <div style={S.actionHeader}>
                <span style={S.actionTitle}>⚡ Needs Attention</span>
                <span style={S.actionCount}>{gamesNeedingScore.length + (gamesThisWeek.length > 0 ? 1 : 0) + unpaidTeams.length} item{(gamesNeedingScore.length + (gamesThisWeek.length > 0 ? 1 : 0) + unpaidTeams.length) !== 1 ? 's' : ''}</span>
              </div>
              <div style={S.actionItems}>
                {gamesNeedingScore.length > 0 && (
                  <a href={`/league-portal/${leagueId}/schedule`} style={S.actionItem}>
                    <div style={{ ...S.actionDot, background: '#FF453A' }} />
                    <div style={S.actionText}>
                      <span style={S.actionLabel}>{gamesNeedingScore.length} game{gamesNeedingScore.length !== 1 ? 's' : ''} missing scores</span>
                      <span style={S.actionSub}>Past games waiting for final score entry</span>
                    </div>
                    <span style={S.actionArrow}>→</span>
                  </a>
                )}
                {gamesThisWeek.length > 0 && (
                  <a href={`/league-portal/${leagueId}/schedule`} style={S.actionItem}>
                    <div style={{ ...S.actionDot, background: '#F5C542' }} />
                    <div style={S.actionText}>
                      <span style={S.actionLabel}>{gamesThisWeek.length} game{gamesThisWeek.length !== 1 ? 's' : ''} this week</span>
                      <span style={S.actionSub}>
                        {gamesThisWeek[0] && (() => {
                          const d = new Date(gamesThisWeek[0].scheduled_at)
                          return `Next: ${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                        })()}
                      </span>
                    </div>
                    <span style={S.actionArrow}>→</span>
                  </a>
                )}
                {unpaidTeams.length > 0 && (
                  <a href={`/league-portal/${leagueId}/budget`} style={S.actionItem}>
                    <div style={{ ...S.actionDot, background: '#BF5AF2' }} />
                    <div style={S.actionText}>
                      <span style={S.actionLabel}>{unpaidTeams.length} team{unpaidTeams.length !== 1 ? 's' : ''} unpaid</span>
                      <span style={S.actionSub}>
                        ${(unpaidTeams.length * (league.fee_amount ?? 0)).toLocaleString()} outstanding · {unpaidTeams.map(t => t.name).slice(0, 3).join(', ')}{unpaidTeams.length > 3 ? `… +${unpaidTeams.length - 3}` : ''}
                      </span>
                    </div>
                    <span style={S.actionArrow}>→</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div style={S.statsRow}>
            {[
              { label: 'Teams', value: String(teams.length) },
              { label: 'Players', value: String(playerCount) },
              { label: 'Games Played', value: String(gamesPlayed) },
              { label: 'Upcoming', value: String(upcomingCount) },
              { label: 'Total Games', value: String(games.length) },
            ].map(s => (
              <div key={s.label} style={S.statCard}>
                <div style={S.statVal}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
            <div style={{ ...S.statCard, borderColor: paidTeams === teams.length && teams.length > 0 ? 'rgba(57,255,20,0.3)' : '#1C1C26' }}>
              <div style={{ ...S.statVal, color: paidTeams === teams.length && teams.length > 0 ? '#39FF14' : paidTeams > 0 ? '#F5C542' : '#6A6A82' }}>
                {paidTeams}/{teams.length}
              </div>
              <div style={S.statLabel}>Teams Paid</div>
              {league.fee_amount ? (
                <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                  ${(paidTeams * league.fee_amount).toLocaleString()} / ${(teams.length * league.fee_amount).toLocaleString()}
                </div>
              ) : null}
            </div>
          </div>

          {/* Quick nav cards */}
          <div style={S.navGrid}>
            {[
              { href: `/league-portal/${leagueId}/teams`, icon: '👥', title: 'Teams & Rosters', desc: `${teams.length} team${teams.length !== 1 ? 's' : ''}`, badge: null },
              { href: `/league-portal/${leagueId}/schedule`, icon: '📅', title: 'Schedule & Scores', desc: `${games.length} game${games.length !== 1 ? 's' : ''} scheduled`, badge: gamesNeedingScore.length > 0 ? { text: `${gamesNeedingScore.length} need scores`, color: '#FF453A' } : null },
              { href: `/league-portal/${leagueId}/standings`, icon: '🏆', title: 'Standings', desc: 'Live W/L table', badge: null },
              { href: `/league-portal/${leagueId}/stats`, icon: '📊', title: 'Stats Leaders', desc: 'Per-game leaderboard', badge: null },
              { href: `/league-portal/${leagueId}/budget`, icon: '💰', title: 'Budget & Payments', desc: league.fee_amount ? `$${(paidTeams * league.fee_amount).toLocaleString()} collected · ${unpaidTeams.length} unpaid` : 'Track income & expenses', badge: unpaidTeams.length > 0 ? { text: `${unpaidTeams.length} unpaid`, color: '#BF5AF2' } : null },
              { href: `/league-portal/${leagueId}/settings`, icon: '⚙️', title: 'Settings', desc: 'Stats, rules & details', badge: null },
            ].map(item => (
              <a key={item.href} href={item.href} style={S.navCard}>
                <div style={S.navCardIcon}>{item.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={S.navCardTitle}>{item.title}</div>
                  <div style={S.navCardDesc}>{item.desc}</div>
                </div>
                {item.badge && (
                  <div style={{ background: `${item.badge.color}22`, border: `1px solid ${item.badge.color}55`, color: item.badge.color, fontSize: 11, padding: '3px 10px', borderRadius: 99, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' as const }}>
                    {item.badge.text}
                  </div>
                )}
                <div style={S.navCardArrow}>→</div>
              </a>
            ))}
            <a href={`/league/${league.slug}`} target="_blank" rel="noreferrer" style={{ ...S.navCard, borderColor: 'rgba(57,255,20,0.2)' }}>
              <div style={S.navCardIcon}>🔗</div>
              <div>
                <div style={S.navCardTitle}>Player League Page</div>
                <div style={S.navCardDesc}>netrrating.com/league/{league.slug} — share with your players</div>
              </div>
              <div style={S.navCardArrow}>↗</div>
            </a>
          </div>

          {league.description && (
            <div style={S.descCard}>
              <div style={S.descLabel}>About This League</div>
              <p style={S.descText}>{league.description}</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}

export function PortalNav({ leagueName, leagueId, active, logoUrl }: { leagueName: string; leagueId: string; active: string; logoUrl?: string | null }) {
  const tabs = [
    { key: 'overview',  label: 'Overview',  href: `/league-portal/${leagueId}` },
    { key: 'teams',     label: 'Teams',     href: `/league-portal/${leagueId}/teams` },
    { key: 'schedule',  label: 'Schedule',  href: `/league-portal/${leagueId}/schedule` },
    { key: 'standings', label: 'Standings', href: `/league-portal/${leagueId}/standings` },
    { key: 'stats',     label: 'Stats',     href: `/league-portal/${leagueId}/stats` },
    { key: 'budget',    label: 'Budget',    href: `/league-portal/${leagueId}/budget` },
    { key: 'settings',  label: 'Settings',  href: `/league-portal/${leagueId}/settings` },
  ]

  return (
    <nav style={S.nav}>
      <div style={S.navTop}>
        <a href="/league-portal" style={S.backLink}>← My Leagues</a>
        <span style={S.logo}>
          {logoUrl && <img src={logoUrl} alt="" style={{ width: 26, height: 26, borderRadius: 5, objectFit: 'cover', marginRight: 8, verticalAlign: 'middle' }} />}
          NETR <span style={{ color: '#EEEEF5' }}>LEAGUES</span>
        </span>
      </div>
      <div style={S.tabRow}>
        {tabs.map(t => (
          <a key={t.key} href={t.href} style={{ ...S.tab, ...(active === t.key ? S.tabActive : {}) }}>
            {t.label}
          </a>
        ))}
      </div>
    </nav>
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
  nav: { background: '#0A0A0E', borderBottom: '1px solid #1C1C26', position: 'sticky' as const, top: 0, zIndex: 50 },
  navTop: { maxWidth: 1200, margin: '0 auto', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #14141C' },
  backLink: { color: '#6A6A82', fontSize: 13, textDecoration: 'none', fontFamily: "'DM Mono', monospace" },
  logo: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: '#39FF14' },
  tabRow: { maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 0, overflowX: 'auto' as const },
  tab: { padding: '14px 18px', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' as const, color: '#EEEEF5', textDecoration: 'none', borderBottom: '2px solid transparent', transition: 'color 0.2s', whiteSpace: 'nowrap' as const },
  tabActive: { color: '#39FF14', borderBottomColor: '#39FF14' },
  main: { maxWidth: 1200, margin: '0 auto', padding: '40px 24px' },
  leagueHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap' as const, gap: 16 },
  sport: { fontSize: 13, color: '#6A6A82', marginBottom: 6 },
  leagueName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 42, textTransform: 'uppercase' as const, marginBottom: 10, lineHeight: 1 },
  meta: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  chip: { background: '#1C1C26', color: '#EEEEF5', fontSize: 12, padding: '4px 12px', borderRadius: 99 },
  statusBadge: { fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 14px', borderRadius: 99, letterSpacing: 0.5, whiteSpace: 'nowrap' as const },

  // Action items
  actionCard: { background: '#0A0A0E', border: '1px solid rgba(255,68,85,0.25)', borderRadius: 14, marginBottom: 28, overflow: 'hidden' },
  actionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #14141C' },
  actionTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#EEEEF5' },
  actionCount: { fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6A6A82' },
  actionItems: { display: 'flex', flexDirection: 'column' as const },
  actionItem: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #0D0D14', textDecoration: 'none', color: '#EEEEF5', transition: 'background 0.15s' },
  actionDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  actionText: { flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 2 },
  actionLabel: { fontSize: 14, fontWeight: 600, color: '#EEEEF5' },
  actionSub: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  actionArrow: { color: '#39FF14', fontSize: 16, fontFamily: "'DM Mono', monospace" },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 32 },
  statCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, padding: '20px', textAlign: 'center' as const },
  statVal: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: '#39FF14', lineHeight: 1, marginBottom: 4 },
  statLabel: { fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 1, fontFamily: "'DM Mono', monospace" },

  navGrid: { display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 32 },
  navCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, padding: '18px 22px', textDecoration: 'none', color: '#EEEEF5', display: 'flex', alignItems: 'center', gap: 14, transition: 'border-color 0.2s' },
  navCardIcon: { fontSize: 26, width: 40, textAlign: 'center' as const, flexShrink: 0 },
  navCardTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  navCardDesc: { fontSize: 12, color: '#6A6A82' },
  navCardArrow: { marginLeft: 'auto' as const, color: '#39FF14', fontSize: 18, fontFamily: "'DM Mono', monospace", flexShrink: 0 },

  descCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, padding: 24 },
  descLabel: { fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8, fontFamily: "'DM Mono', monospace" },
  descText: { fontSize: 15, color: '#EEEEF5', lineHeight: 1.6 },
}
