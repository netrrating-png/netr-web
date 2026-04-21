import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League } from '../../lib/supabase'

export default function LeaguePortalHome() {
  const router = useRouter()
  const [leagues, setLeagues] = useState<League[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }
      setUserEmail(user.email ?? '')
      const { data } = await supabase
        .from('leagues')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setLeagues(data ?? [])
      setLoading(false)
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/league-portal/login')
  }

  if (loading) return <LoadingScreen />

  return (
    <>
      <Head>
        <title>My Leagues — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        {/* Top nav */}
        <nav style={S.nav}>
          <div style={S.navInner}>
            <span style={S.logo}>NETR <span style={S.logoSub}>LEAGUES</span></span>
            <div style={S.navRight}>
              <span style={S.email}>{userEmail}</span>
              <button onClick={handleLogout} style={S.logoutBtn}>Sign Out</button>
            </div>
          </div>
        </nav>

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>My Leagues</h1>
              <p style={S.subtitle}>Manage your recreational basketball leagues</p>
            </div>
            <a href="/league-portal/new" style={S.newBtn}>+ New League</a>
          </div>

          {leagues.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={S.grid}>
              {leagues.map(league => (
                <LeagueCard key={league.id} league={league} />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}

function LeagueCard({ league }: { league: League }) {
  return (
    <a href={`/league-portal/${league.id}`} style={S.card}>
      <div style={S.cardTop}>
        <div style={S.cardIcon}>🏀</div>
        <span style={{ ...S.badge, background: league.is_active ? 'rgba(57,255,20,0.12)' : 'rgba(106,106,130,0.15)', color: league.is_active ? '#39FF14' : '#6A6A82' }}>
          {league.is_active ? 'Active' : 'Archived'}
        </span>
      </div>
      <h3 style={S.cardName}>{league.name}</h3>
      {league.season && <div style={S.cardSeason}>{league.season}</div>}
      {league.location && <div style={S.cardLocation}>📍 {league.location}</div>}
      <div style={S.cardArrow}>Manage →</div>
    </a>
  )
}

function EmptyState() {
  return (
    <div style={S.empty}>
      <div style={S.emptyIcon}>🏀</div>
      <h2 style={S.emptyTitle}>No leagues yet</h2>
      <p style={S.emptySub}>Create your first league to get started. Add teams, schedule games, and track stats all in one place.</p>
      <a href="/league-portal/new" style={S.emptyBtn}>Create Your First League</a>
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
  navInner: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '0 24px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 26,
    color: '#39FF14',
    textShadow: '0 0 12px rgba(57,255,20,0.4)',
    letterSpacing: 1,
  },
  logoSub: {
    color: '#EEEEF5',
    opacity: 0.6,
  },
  navRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  email: {
    fontSize: 13,
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
  },
  logoutBtn: {
    background: 'transparent',
    border: '1px solid #2E2E3A',
    borderRadius: 8,
    color: '#6A6A82',
    fontSize: 13,
    padding: '6px 14px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', sans-serif",
    transition: 'border-color 0.2s, color 0.2s',
  },
  main: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '40px 24px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap' as const,
    gap: 16,
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 36,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  subtitle: {
    color: '#6A6A82',
    fontSize: 15,
  },
  newBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '12px 24px',
    borderRadius: 10,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 14,
    padding: 24,
    textDecoration: 'none',
    color: '#EEEEF5',
    display: 'block',
    transition: 'border-color 0.2s, transform 0.2s',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 28,
  },
  badge: {
    fontSize: 11,
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '3px 10px',
    borderRadius: 99,
  },
  cardName: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 22,
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  cardSeason: {
    fontSize: 13,
    color: '#39FF14',
    marginBottom: 4,
  },
  cardLocation: {
    fontSize: 13,
    color: '#6A6A82',
    marginBottom: 16,
  },
  cardArrow: {
    fontSize: 13,
    color: '#39FF14',
    fontFamily: "'DM Mono', monospace",
  },
  empty: {
    textAlign: 'center' as const,
    padding: '80px 24px',
    maxWidth: 480,
    margin: '0 auto',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 32,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  emptySub: {
    color: '#6A6A82',
    fontSize: 15,
    lineHeight: 1.6,
    marginBottom: 28,
  },
  emptyBtn: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '14px 32px',
    borderRadius: 10,
    textDecoration: 'none',
  },
}
