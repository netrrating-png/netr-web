import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueTeam, LeagueGame } from '../../../lib/supabase'
import { STAT_DEFS, DEFAULT_ENABLED_STATS, StatKey } from '../../../lib/stat-config'

export default function LeagueOverview() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [games, setGames] = useState<LeagueGame[]>([])
  const [loading, setLoading] = useState(true)
  const [enabledStats, setEnabledStats] = useState<StatKey[]>([])
  const [statsSaving, setStatsSaving] = useState(false)
  const [statsSaved, setStatsSaved] = useState(false)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, gamesRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId),
        supabase.from('league_games').select('*').eq('league_id', leagueId).order('scheduled_at'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)
      setEnabledStats((leagueRes.data.enabled_stats ?? DEFAULT_ENABLED_STATS) as StatKey[])
      setTeams(teamsRes.data ?? [])
      setGames(gamesRes.data ?? [])
      setLoading(false)
    })
  }, [leagueId])

  async function toggleStat(key: StatKey) {
    const next = enabledStats.includes(key)
      ? enabledStats.filter(k => k !== key)
      : [...enabledStats, key]
    setEnabledStats(next)
    setStatsSaving(true)
    await supabase.from('leagues').update({ enabled_stats: next }).eq('id', leagueId)
    setStatsSaving(false)
    setStatsSaved(true)
    setTimeout(() => setStatsSaved(false), 2000)
  }

  if (loading || !league) return <LoadingScreen />

  const gamesPlayed = games.filter(g => g.status === 'final').length
  const upcoming = games.filter(g => g.status === 'scheduled').length

  return (
    <>
      <Head>
        <title>{league.name} — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="overview" />

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

          {/* Quick stats */}
          <div style={S.statsRow}>
            {[
              { label: 'Teams', value: teams.length },
              { label: 'Games Played', value: gamesPlayed },
              { label: 'Upcoming', value: upcoming },
              { label: 'Total Games', value: games.length },
            ].map(s => (
              <div key={s.label} style={S.statCard}>
                <div style={S.statVal}>{s.value}</div>
                <div style={S.statLabel}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick nav cards */}
          <div style={S.navGrid}>
            {[
              { href: `/league-portal/${leagueId}/teams`, icon: '👥', title: 'Teams & Rosters', desc: `${teams.length} team${teams.length !== 1 ? 's' : ''}` },
              { href: `/league-portal/${leagueId}/schedule`, icon: '📅', title: 'Schedule & Scores', desc: `${games.length} game${games.length !== 1 ? 's' : ''} scheduled` },
              { href: `/league-portal/${leagueId}/standings`, icon: '🏆', title: 'Standings', desc: 'Live W/L table' },
              { href: `/league-portal/${leagueId}/stats`, icon: '📊', title: 'Stats Leaders', desc: `${enabledStats.length} stat${enabledStats.length !== 1 ? 's' : ''} tracked` },
            ].map(item => (
              <a key={item.href} href={item.href} style={S.navCard}>
                <div style={S.navCardIcon}>{item.icon}</div>
                <div>
                  <div style={S.navCardTitle}>{item.title}</div>
                  <div style={S.navCardDesc}>{item.desc}</div>
                </div>
                <div style={S.navCardArrow}>→</div>
              </a>
            ))}
          </div>

          {/* Stat Settings */}
          <div style={S.settingsCard}>
            <div style={S.settingsHeader}>
              <div>
                <div style={S.settingsTitle}>Tracked Stats</div>
                <div style={S.settingsDesc}>Choose which stats are recorded in box scores and displayed in the leaderboard.</div>
              </div>
              <div style={S.savingStatus}>
                {statsSaving && <span style={S.saving}>Saving…</span>}
                {statsSaved && <span style={S.saved}>✓ Saved</span>}
              </div>
            </div>
            <div style={S.toggleGrid}>
              {STAT_DEFS.map(def => {
                const on = enabledStats.includes(def.key)
                return (
                  <button
                    key={def.key}
                    onClick={() => toggleStat(def.key)}
                    style={{ ...S.toggleChip, ...(on ? S.toggleChipOn : S.toggleChipOff) }}
                  >
                    <span style={S.toggleLabel}>{def.label}</span>
                    <span style={{ ...S.toggleFull, ...(on ? {} : { color: '#3A3A4E' }) }}>{def.fullLabel}</span>
                  </button>
                )
              })}
            </div>
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

export function PortalNav({ leagueName, leagueId, active }: { leagueName: string; leagueId: string; active: string }) {
  const tabs = [
    { key: 'overview',  label: 'Overview',        href: `/league-portal/${leagueId}` },
    { key: 'teams',     label: 'Teams',            href: `/league-portal/${leagueId}/teams` },
    { key: 'schedule',  label: 'Schedule',         href: `/league-portal/${leagueId}/schedule` },
    { key: 'standings', label: 'Standings',        href: `/league-portal/${leagueId}/standings` },
    { key: 'stats',     label: 'Stats',            href: `/league-portal/${leagueId}/stats` },
  ]

  return (
    <nav style={S.nav}>
      <div style={S.navTop}>
        <a href="/league-portal" style={S.backLink}>← My Leagues</a>
        <span style={S.logo}>NETR <span style={{ color: '#EEEEF5', opacity: 0.5 }}>LEAGUES</span></span>
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
  page: {
    minHeight: '100vh',
    background: '#040406',
    fontFamily: "'DM Sans', sans-serif",
    color: '#EEEEF5',
  },
  nav: {
    background: '#0A0A0E',
    borderBottom: '1px solid #1C1C26',
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  },
  navTop: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    height: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottom: '1px solid #14141C',
  },
  backLink: {
    color: '#6A6A82',
    fontSize: 13,
    textDecoration: 'none',
    fontFamily: "'DM Mono', monospace",
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 20,
    color: '#39FF14',
  },
  tabRow: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    display: 'flex',
    gap: 0,
  },
  tab: {
    padding: '14px 20px',
    fontSize: 13,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    color: '#6A6A82',
    textDecoration: 'none',
    borderBottom: '2px solid transparent',
    transition: 'color 0.2s',
  },
  tabActive: {
    color: '#39FF14',
    borderBottomColor: '#39FF14',
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 24px',
  },
  leagueHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  sport: {
    fontSize: 13,
    color: '#6A6A82',
    marginBottom: 6,
  },
  leagueName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 42,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    lineHeight: 1,
  },
  meta: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  chip: {
    background: '#1C1C26',
    color: '#EEEEF5',
    fontSize: 12,
    padding: '4px 12px',
    borderRadius: 99,
  },
  statusBadge: {
    fontSize: 12,
    fontFamily: "'DM Mono', monospace",
    padding: '6px 14px',
    borderRadius: 99,
    letterSpacing: 0.5,
    whiteSpace: 'nowrap' as const,
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 16,
    marginBottom: 32,
  },
  statCard: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 12,
    padding: '20px',
    textAlign: 'center' as const,
  },
  statVal: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 36,
    color: '#39FF14',
    lineHeight: 1,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    fontFamily: "'DM Mono', monospace",
  },
  navGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    marginBottom: 32,
  },
  navCard: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 12,
    padding: '20px 24px',
    textDecoration: 'none',
    color: '#EEEEF5',
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    transition: 'border-color 0.2s',
  },
  navCardIcon: {
    fontSize: 28,
    width: 44,
    textAlign: 'center' as const,
  },
  navCardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  navCardDesc: {
    fontSize: 13,
    color: '#6A6A82',
  },
  navCardArrow: {
    marginLeft: 'auto' as const,
    color: '#39FF14',
    fontSize: 18,
    fontFamily: "'DM Mono', monospace",
  },
  settingsCard: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 12,
    padding: '24px',
    marginBottom: 32,
  },
  settingsHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 16,
  },
  settingsTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  settingsDesc: {
    fontSize: 13,
    color: '#6A6A82',
    lineHeight: 1.5,
  },
  savingStatus: {
    minWidth: 60,
    textAlign: 'right' as const,
  },
  saving: {
    fontSize: 12,
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
  },
  saved: {
    fontSize: 12,
    color: '#39FF14',
    fontFamily: "'DM Mono', monospace",
  },
  toggleGrid: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  toggleChip: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    transition: 'all 0.15s',
    minWidth: 80,
  },
  toggleChipOn: {
    background: 'rgba(57,255,20,0.12)',
    outline: '1.5px solid #39FF14',
  },
  toggleChipOff: {
    background: '#0A0A0E',
    outline: '1.5px solid #1C1C26',
  },
  toggleLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.5,
    color: '#EEEEF5',
  },
  toggleFull: {
    fontSize: 10,
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
    whiteSpace: 'nowrap' as const,
  },
  descCard: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 12,
    padding: 24,
  },
  descLabel: {
    fontSize: 11,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 8,
    fontFamily: "'DM Mono', monospace",
  },
  descText: {
    fontSize: 15,
    color: '#EEEEF5',
    lineHeight: 1.6,
  },
}
