import Head from 'next/head'
import { useState, useMemo } from 'react'

const TEAM_PASSWORD = 'dimesandnickles4'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obroygzzfpphumsrqtsm.supabase.co'
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function sbCount(table: string, filter = ''): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=id`
  if (filter) url += `&${filter}`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    })
    const range = res.headers.get('Content-Range') || ''
    const total = range.split('/')[1]
    return total && total !== '*' ? parseInt(total, 10) : 0
  } catch { return 0 }
}

async function sbFetch(table: string, select = '*', filter = '', order = '', limit = 100): Promise<any[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`
  if (filter) url += `&${filter}`
  if (order) url += `&order=${order}`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Prefer': 'count=none',
        'Range': `0-${limit - 1}`,
      },
    })
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

function fmt(n: number) { return n.toLocaleString() }
function fmtDate(s: string) { return s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—' }
function fmtScore(n: number) { return n != null ? n.toFixed(1) : '—' }

type Tab = 'overview' | 'users' | 'courts' | 'ratings' | 'feed' | 'leagues' | 'qr'

const C = {
  green: '#39FF14',
  blue: '#4A9EFF',
  yellow: '#F5C542',
  purple: '#9B6DFF',
  red: '#FF4545',
  orange: '#FF8C00',
  bg: '#040406',
  card: '#0F0F14',
  border: '#1C1C26',
  nav: '#0A0A0D',
  text: '#EEEEF5',
  muted: '#6A6A82',
}

const badge = (color: string, text: string) => (
  <span style={{
    display: 'inline-block',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    color,
    borderRadius: 99,
    padding: '2px 10px',
    fontSize: 11,
    fontWeight: 700,
    fontFamily: 'monospace',
    whiteSpace: 'nowrap' as const,
  }}>{text}</span>
)

const SearchBox = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    style={{
      background: C.nav,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      color: C.text,
      padding: '9px 14px',
      fontSize: 13,
      fontFamily: "'DM Sans', sans-serif",
      outline: 'none',
      width: '100%',
      boxSizing: 'border-box' as const,
      marginBottom: 16,
    }}
  />
)

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [loginError, setLoginError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)

  const [counts, setCounts] = useState({
    users: 0, courts: 0, verified: 0, pending: 0,
    ratings: 0, posts: 0, leagues: 0, activeLeagues: 0,
    teams: 0, players: 0, games: 0,
  })
  const [users, setUsers] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [pendingCourts, setPendingCourts] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])
  const [leagues, setLeagues] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [courtSearch, setCourtSearch] = useState('')

  const campaigns = [
    { key: 'default', label: 'Default / Beta', url: '/qr?c=default' },
    { key: 'rucker', label: 'Rucker Park', url: '/qr?c=rucker' },
    { key: 'dyckman', label: 'Dyckman Park', url: '/qr?c=dyckman' },
    { key: 'west4', label: 'West 4th Street', url: '/qr?c=west4' },
    { key: 'flyer', label: 'Flyer / Print', url: '/qr?c=flyer' },
    { key: 'instagram', label: 'Instagram Bio', url: '/qr?c=instagram' },
  ]

  function login() {
    if (pw === TEAM_PASSWORD) { setAuthed(true); loadData() }
    else { setLoginError('Wrong password'); setTimeout(() => setLoginError(''), 2000) }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [
        usersCount, courtsCount, verifiedCount, pendingCount,
        ratingsCount, postsCount, leaguesCount, activeLeaguesCount,
        teamsCount, playersCount, gamesCount,
        recentUsers, allCourts, pendingList, recentRatings, recentPosts, allLeagues,
      ] = await Promise.all([
        sbCount('profiles'),
        sbCount('courts'),
        sbCount('courts', 'verified=eq.true'),
        sbCount('courts', 'verified=eq.false'),
        sbCount('ratings'),
        sbCount('feed_posts'),
        sbCount('leagues'),
        sbCount('leagues', 'is_active=eq.true'),
        sbCount('league_teams'),
        sbCount('league_players'),
        sbCount('league_games'),
        sbFetch('profiles', 'id,username,full_name,netr_score,created_at', '', 'created_at.desc', 1000),
        sbFetch('courts', 'id,name,city,verified,surface,created_at', '', 'created_at.desc', 5000),
        sbFetch('courts', 'id,name,city,submitted_by,created_at', 'verified=eq.false', 'created_at.desc', 500),
        sbFetch('ratings', 'id,rater_id,rated_id,overall_score,created_at', '', 'created_at.desc', 100),
        sbFetch('feed_posts', 'id,author_id,content,created_at', '', 'created_at.desc', 50),
        sbFetch('leagues', 'id,name,slug,sport,season,is_active,created_at,owner_id,location,league_teams(count),league_players(count),league_games(count)', '', 'created_at.desc', 500),
      ])

      setCounts({ users: usersCount, courts: courtsCount, verified: verifiedCount, pending: pendingCount, ratings: ratingsCount, posts: postsCount, leagues: leaguesCount, activeLeagues: activeLeaguesCount, teams: teamsCount, players: playersCount, games: gamesCount })
      setUsers(recentUsers)
      setCourts(allCourts)
      setPendingCourts(pendingList)
      setRatings(recentRatings)
      setPosts(recentPosts)
      setLeagues(allLeagues)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  async function approveCourt(id: string) {
    const res = await fetch('/api/admin/approve-court', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: TEAM_PASSWORD }),
    })
    if (!res.ok) { const err = await res.json(); alert(err.error || 'Failed to approve court'); return }
    setPendingCourts(p => p.filter(c => c.id !== id))
    setCourts(prev => prev.map(c => c.id === id ? { ...c, verified: true } : c))
    setCounts(c => ({ ...c, pending: Math.max(0, c.pending - 1), verified: c.verified + 1 }))
  }

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.toLowerCase()
    return users.filter(u => u.username?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q))
  }, [users, userSearch])

  const filteredCourts = useMemo(() => {
    if (!courtSearch.trim()) return courts
    const q = courtSearch.toLowerCase()
    return courts.filter(c => c.name?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q))
  }, [courts, courtSearch])

  const CSS = `
    *{box-sizing:border-box}
    body{margin:0}
    .dash-main{max-width:1200px;margin:0 auto;padding:28px 20px}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px}
    .stat-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:24px}
    .qr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px}
    .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .tab-bar{display:flex;gap:8px;overflow-x:auto;padding:10px 16px;background:${C.nav};border-bottom:1px solid ${C.border};scrollbar-width:none;-ms-overflow-style:none;position:sticky;top:57px;z-index:40}
    .tab-bar::-webkit-scrollbar{display:none}
    .tab-btn{padding:7px 16px;border-radius:99px;cursor:pointer;font-weight:600;font-size:13px;font-family:'DM Sans',sans-serif;white-space:nowrap;border:none;transition:all .15s}
    .tab-btn.active{background:${C.green};color:${C.bg}}
    .tab-btn.inactive{background:transparent;color:${C.muted};border:1px solid ${C.border}}
    .tab-btn.inactive:hover{color:${C.text};border-color:#3A3A4A}
    .card{background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:20px}
    .stat-card{background:${C.card};border-radius:12px;padding:18px 20px;border-top:2px solid;position:relative;overflow:hidden}
    .stat-num{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:38px;line-height:1;margin:6px 0 4px}
    .stat-label{font-size:11px;color:${C.muted};text-transform:uppercase;letter-spacing:1.2px;font-weight:600}
    .section-title{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:22px;color:${C.text};margin:0 0 16px}
    .table{width:100%;border-collapse:collapse;font-size:13px}
    .table th{text-align:left;padding:10px 14px;color:${C.muted};font-size:11px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid ${C.border};font-weight:600;white-space:nowrap}
    .table td{padding:11px 14px;border-bottom:1px solid ${C.bg};color:${C.text};vertical-align:middle}
    .table tr:last-child td{border-bottom:none}
    .table tr:hover td{background:#13131A}
    .nav{background:${C.nav};border-bottom:1px solid ${C.border};padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:50}
    .nav-btn{font-size:12px;background:none;border:1px solid ${C.border};border-radius:6px;padding:5px 12px;cursor:pointer;font-family:'DM Sans',sans-serif}
    .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
    .mono{font-family:'DM Mono',monospace}
    @media(max-width:900px){
      .stat-grid{grid-template-columns:repeat(2,1fr)}
      .stat-grid-3{grid-template-columns:repeat(2,1fr)}
    }
    @media(max-width:600px){
      .dash-main{padding:16px 12px}
      .stat-grid{grid-template-columns:repeat(2,1fr);gap:10px}
      .stat-grid-3{grid-template-columns:repeat(2,1fr);gap:10px}
      .stat-num{font-size:30px}
      .card{padding:14px}
      .table th,.table td{padding:9px 10px;font-size:12px}
      .qr-grid{grid-template-columns:1fr}
    }
  `

  if (!authed) {
    return (
      <>
        <Head>
          <title>NETR · Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,nofollow" />
          <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
          <style dangerouslySetInnerHTML={{ __html: CSS }} />
        </Head>
        <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', width: 600, height: 600, background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }} />
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: '48px 40px', width: '100%', maxWidth: 400, position: 'relative', zIndex: 1 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: C.green, textShadow: `0 0 20px ${C.green}55`, marginBottom: 2 }}>NETR</div>
            <div style={{ fontSize: 11, color: C.muted, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: 40 }}>TEAM ADMIN</div>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Password</label>
            <input
              type="password"
              placeholder="Enter team password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              autoFocus
              style={{ width: '100%', background: C.nav, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: '12px 16px', fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            />
            <button
              onClick={login}
              style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, ${C.green}, #00CC2A)`, border: 'none', borderRadius: 10, color: C.bg, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: 1, cursor: 'pointer', boxShadow: `0 8px 24px ${C.green}33` }}
            >
              SIGN IN
            </button>
            {loginError && <div style={{ color: C.red, textAlign: 'center', marginTop: 12, fontSize: 13 }}>{loginError}</div>}
            <div style={{ marginTop: 28, fontSize: 11, color: '#2A2A38', textAlign: 'center', fontFamily: 'monospace' }}>team access only · netr.pro/admin</div>
          </div>
        </div>
      </>
    )
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'users', label: `👥 Users${counts.users ? ` (${fmt(counts.users)})` : ''}` },
    { key: 'courts', label: `🏀 Courts${counts.pending > 0 ? ` · ${counts.pending} pending` : ''}` },
    { key: 'ratings', label: `⭐ Ratings` },
    { key: 'feed', label: `📢 Feed` },
    { key: 'leagues', label: `🏆 Leagues${counts.leagues ? ` (${counts.leagues})` : ''}` },
    { key: 'qr', label: `📷 QR Codes` },
  ]

  const StatCard = ({ label, value, color, sub }: { label: string; value: number | string; color: string; sub?: string }) => (
    <div className="stat-card" style={{ borderTopColor: color }}>
      <div className="stat-label">{label}</div>
      <div className="stat-num" style={{ color }}>{typeof value === 'number' ? fmt(value) : value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{sub}</div>}
    </div>
  )

  return (
    <>
      <Head>
        <title>NETR Admin</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
      </Head>

      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: "'DM Sans', sans-serif", fontSize: 14 }}>

        {/* Nav */}
        <div className="nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, color: C.green, textShadow: `0 0 10px ${C.green}55` }}>NETR</span>
            <span style={{ fontSize: 10, color: C.muted, fontFamily: 'monospace', letterSpacing: 3, textTransform: 'uppercase' }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {loading && <span style={{ fontSize: 12, color: C.muted }}>Loading…</span>}
            <button onClick={loadData} className="nav-btn" style={{ color: C.green, borderColor: `${C.green}33` }}>↻ Refresh</button>
            <button onClick={() => setAuthed(false)} className="nav-btn" style={{ color: C.muted }}>Sign Out</button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="tab-bar">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'active' : 'inactive'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="dash-main">

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              {/* Alert bar for pending courts */}
              {counts.pending > 0 && (
                <div onClick={() => setTab('courts')} style={{ background: `${C.yellow}12`, border: `1px solid ${C.yellow}33`, borderRadius: 10, padding: '10px 16px', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: C.yellow, fontWeight: 600, fontSize: 13 }}>⏳ {counts.pending} court{counts.pending !== 1 ? 's' : ''} pending approval</span>
                  <span style={{ color: C.yellow, fontSize: 12 }}>Review →</span>
                </div>
              )}

              {/* Primary stats */}
              <div className="stat-grid" style={{ marginBottom: 14 }}>
                <StatCard label="Total Users" value={counts.users} color={C.green} />
                <StatCard label="Verified Courts" value={counts.verified} color={C.blue} sub={`${counts.courts} total · ${counts.pending} pending`} />
                <StatCard label="Total Ratings" value={counts.ratings} color={C.purple} />
                <StatCard label="Active Leagues" value={counts.activeLeagues} color={C.orange} sub={`${counts.leagues} total`} />
              </div>

              {/* Secondary stats */}
              <div className="stat-grid" style={{ marginBottom: 28 }}>
                <StatCard label="League Teams" value={counts.teams} color={C.yellow} />
                <StatCard label="League Players" value={counts.players} color={C.green} />
                <StatCard label="Games Played" value={counts.games} color={C.blue} />
                <StatCard label="Feed Posts" value={counts.posts} color={C.muted} />
              </div>

              {/* Recent signups + recent ratings side by side */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div className="card">
                  <div className="section-title">Recent Signups</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>NETR</th>
                          <th>Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.slice(0, 10).map((u, i) => (
                          <tr key={i}>
                            <td>
                              <div style={{ color: C.green, fontFamily: 'monospace', fontSize: 12 }}>@{u.username || '—'}</div>
                              {u.full_name && <div style={{ color: C.muted, fontSize: 11, marginTop: 1 }}>{u.full_name}</div>}
                            </td>
                            <td>{badge(C.green, fmtScore(u.netr_score))}</td>
                            <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card">
                  <div className="section-title">Recent Ratings</div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Rater</th>
                          <th>Rated</th>
                          <th>Score</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratings.slice(0, 10).map((r, i) => {
                          const col = r.overall_score >= 7 ? C.green : r.overall_score >= 4 ? C.yellow : C.red
                          return (
                            <tr key={i}>
                              <td style={{ color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>{r.rater_id?.slice(0, 8)}…</td>
                              <td style={{ color: C.muted, fontFamily: 'monospace', fontSize: 11 }}>{r.rated_id?.slice(0, 8)}…</td>
                              <td>{badge(col, fmtScore(r.overall_score))}</td>
                              <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Courts breakdown */}
              <div className="card">
                <div className="section-title">Courts Breakdown</div>
                <div className="stat-grid-3" style={{ marginBottom: 0 }}>
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: C.blue }}>{fmt(counts.courts)}</div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Total Courts</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px 0', borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}` }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: C.green }}>{fmt(counts.verified)}</div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Verified</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{counts.courts > 0 ? Math.round(counts.verified / counts.courts * 100) : 0}% of total</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: C.yellow }}>{fmt(counts.pending)}</div>
                    <div style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>Pending</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div className="card">
              <div className="page-header">
                <div>
                  <div className="section-title" style={{ marginBottom: 4 }}>All Users</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{fmt(filteredUsers.length)} of {fmt(counts.users)} users{userSearch ? ' matching search' : ''}</div>
                </div>
              </div>
              <SearchBox value={userSearch} onChange={setUserSearch} placeholder="Search by username or name…" />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Full Name</th>
                      <th>NETR Score</th>
                      <th>Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={i}>
                        <td><span style={{ color: C.green, fontFamily: 'monospace', fontSize: 13 }}>@{u.username || '—'}</span></td>
                        <td style={{ color: u.full_name ? C.text : C.muted }}>{u.full_name || '—'}</td>
                        <td>{badge(u.netr_score >= 7 ? C.green : u.netr_score >= 4 ? C.yellow : C.blue, fmtScore(u.netr_score))}</td>
                        <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(u.created_at)}</td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: C.muted, padding: 32 }}>No users found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── COURTS ── */}
          {tab === 'courts' && (
            <>
              {/* Stats row */}
              <div className="stat-grid-3" style={{ marginBottom: 20 }}>
                <StatCard label="Total Courts" value={counts.courts} color={C.blue} />
                <StatCard label="Verified" value={counts.verified} color={C.green} />
                <StatCard label="Pending Approval" value={counts.pending} color={C.yellow} />
              </div>

              {/* Pending queue */}
              {pendingCourts.length > 0 && (
                <div className="card" style={{ borderColor: `${C.yellow}33`, marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                    <div className="section-title" style={{ color: C.yellow, marginBottom: 0 }}>⏳ Pending Approval ({pendingCourts.length})</div>
                  </div>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Court Name</th>
                          <th>City</th>
                          <th>Submitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingCourts.map((c, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ color: C.muted }}>{c.city}</td>
                            <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(c.created_at)}</td>
                            <td>
                              <button
                                onClick={() => approveCourt(c.id)}
                                style={{ background: `${C.green}20`, border: `1px solid ${C.green}44`, color: C.green, borderRadius: 6, padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}
                              >
                                ✓ Approve
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* All courts */}
              <div className="card">
                <div className="page-header" style={{ marginBottom: 12 }}>
                  <div>
                    <div className="section-title" style={{ marginBottom: 4 }}>All Courts</div>
                    <div style={{ fontSize: 12, color: C.muted }}>{fmt(filteredCourts.length)} of {fmt(counts.courts)} courts{courtSearch ? ' matching search' : ''}</div>
                  </div>
                </div>
                <SearchBox value={courtSearch} onChange={setCourtSearch} placeholder="Search by court name or city…" />
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Court Name</th>
                        <th>City</th>
                        <th>Surface</th>
                        <th>Status</th>
                        <th>Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourts.map((c, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
                          <td style={{ color: C.muted }}>{c.city || '—'}</td>
                          <td style={{ color: C.muted }}>{c.surface || '—'}</td>
                          <td>{badge(c.verified ? C.green : C.yellow, c.verified ? '✓ Verified' : 'Pending')}</td>
                          <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                      {filteredCourts.length === 0 && (
                        <tr><td colSpan={5} style={{ textAlign: 'center', color: C.muted, padding: 32 }}>No courts found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── RATINGS ── */}
          {tab === 'ratings' && (
            <>
              <div className="stat-grid-3" style={{ marginBottom: 20 }}>
                <StatCard label="Total Ratings" value={counts.ratings} color={C.purple} />
                <StatCard label="Avg Score (shown)" value={ratings.length ? (ratings.reduce((s, r) => s + (r.overall_score || 0), 0) / ratings.length).toFixed(2) : '—'} color={C.green} />
                <StatCard label="Loaded" value={ratings.length} color={C.muted} sub="most recent 100" />
              </div>
              <div className="card">
                <div className="section-title">Recent Ratings</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rater ID</th>
                        <th>Rated ID</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ratings.map((r, i) => {
                        const col = r.overall_score >= 7 ? C.green : r.overall_score >= 4 ? C.yellow : C.red
                        return (
                          <tr key={i}>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>{r.rater_id?.slice(0, 12)}…</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: C.muted }}>{r.rated_id?.slice(0, 12)}…</td>
                            <td>{badge(col, fmtScore(r.overall_score))}</td>
                            <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(r.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── FEED ── */}
          {tab === 'feed' && (
            <>
              <div className="stat-grid-3" style={{ marginBottom: 20 }}>
                <StatCard label="Total Posts" value={counts.posts} color={C.orange} />
                <StatCard label="Loaded" value={posts.length} color={C.muted} sub="most recent 50" />
                <StatCard label="Avg Length" value={posts.length ? Math.round(posts.reduce((s, p) => s + (p.content?.length || 0), 0) / posts.length) + ' chars' : '—'} color={C.muted} />
              </div>
              <div className="card">
                <div className="section-title">Recent Feed Posts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {posts.map((p, i) => (
                    <div key={i} style={{ background: C.nav, borderRadius: 8, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted }}>{p.author_id?.slice(0, 16)}…</span>
                        <span style={{ fontSize: 11, color: C.muted }}>{fmtDate(p.created_at)}</span>
                      </div>
                      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{p.content || '—'}</div>
                    </div>
                  ))}
                  {posts.length === 0 && <div style={{ color: C.muted, textAlign: 'center', padding: 32 }}>No posts yet</div>}
                </div>
              </div>
            </>
          )}

          {/* ── LEAGUES ── */}
          {tab === 'leagues' && (
            <>
              <div className="stat-grid" style={{ marginBottom: 20 }}>
                <StatCard label="Total Leagues" value={counts.leagues} color={C.orange} />
                <StatCard label="Active" value={counts.activeLeagues} color={C.green} />
                <StatCard label="Teams" value={counts.teams} color={C.blue} />
                <StatCard label="Players" value={counts.players} color={C.purple} />
              </div>
              <div className="card">
                <div className="section-title">All Leagues</div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>League</th>
                        <th>Sport</th>
                        <th>Season</th>
                        <th>Teams</th>
                        <th>Players</th>
                        <th>Games</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Page</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leagues.map((lg, i) => {
                        const teamCount = lg.league_teams?.[0]?.count ?? '—'
                        const playerCount = lg.league_players?.[0]?.count ?? '—'
                        const gameCount = lg.league_games?.[0]?.count ?? '—'
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, maxWidth: 180 }}>
                              <div>{lg.name}</div>
                              {lg.location && <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{lg.location}</div>}
                            </td>
                            <td style={{ color: C.muted, textTransform: 'capitalize' }}>{lg.sport || '—'}</td>
                            <td style={{ color: C.muted }}>{lg.season || '—'}</td>
                            <td style={{ fontFamily: 'monospace' }}>{teamCount}</td>
                            <td style={{ fontFamily: 'monospace' }}>{playerCount}</td>
                            <td style={{ fontFamily: 'monospace' }}>{gameCount}</td>
                            <td>{badge(lg.is_active ? C.green : C.muted, lg.is_active ? 'Active' : 'Inactive')}</td>
                            <td style={{ color: C.muted, fontSize: 12 }}>{fmtDate(lg.created_at)}</td>
                            <td>
                              {lg.slug ? (
                                <a href={`/league/${lg.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, fontSize: 12, textDecoration: 'none', fontFamily: 'monospace' }}>
                                  /{lg.slug} ↗
                                </a>
                              ) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {leagues.length === 0 && (
                        <tr><td colSpan={9} style={{ textAlign: 'center', color: C.muted, padding: 32 }}>No leagues yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ── QR CAMPAIGNS ── */}
          {tab === 'qr' && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 28, marginBottom: 6 }}>QR Campaigns</div>
                <div style={{ color: C.muted, fontSize: 14 }}>Unique QR codes per acquisition channel. Print, post, and share.</div>
              </div>
              <div className="qr-grid" style={{ marginBottom: 24 }}>
                {campaigns.map(camp => {
                  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${camp.url}` : camp.url
                  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(fullUrl)}&bgcolor=0F0F14&color=39FF14&margin=10`
                  return (
                    <div key={camp.key} className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrImg} alt={camp.label} width={140} height={140} style={{ borderRadius: 10, marginBottom: 14, border: `1px solid ${C.border}` }} />
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, marginBottom: 2 }}>{camp.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: C.muted, marginBottom: 16 }}>?c={camp.key}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href={camp.url} target="_blank" rel="noopener noreferrer" style={{ background: `${C.green}18`, border: `1px solid ${C.green}33`, color: C.green, borderRadius: 6, padding: '6px 14px', fontSize: 12, textDecoration: 'none', fontWeight: 600 }}>
                          Preview
                        </a>
                        <button onClick={() => navigator.clipboard.writeText(fullUrl)} style={{ background: C.nav, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                          Copy URL
                        </button>
                        <a href={qrImg.replace('200x200', '800x800')} download={`netr-qr-${camp.key}.png`} style={{ background: C.nav, border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '6px 14px', fontSize: 12, textDecoration: 'none' }}>
                          ↓ PNG
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="card" style={{ borderColor: `${C.blue}22` }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 10, color: C.blue }}>📷 How to Use</div>
                <div style={{ color: C.muted, fontSize: 13, lineHeight: 1.9, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
                  <div><strong style={{ color: C.text }}>Courts</strong> — Tape to fence or hoop post at the specific court</div>
                  <div><strong style={{ color: C.text }}>Flyers</strong> — Posters, stickers, merch hangtags</div>
                  <div><strong style={{ color: C.text }}>Instagram</strong> — Link in bio for social traffic</div>
                  <div><strong style={{ color: C.text }}>Download</strong> — ↓ PNG gives 800×800px for print quality</div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
