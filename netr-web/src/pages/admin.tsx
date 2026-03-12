import Head from 'next/head'
import { useState, useEffect } from 'react'

// ─── TEAM CREDENTIALS ─────────────────────────────────────────
// Simple password gate. For production, use Supabase Auth or NextAuth.
const TEAM_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASS || 'NETR2025'

// ─── SUPABASE CONFIG ───────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obroygzzfpphumsrqtsm.supabase.co'
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function supabase(table: string, select = '*', order?: string, limit?: number) {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`
  if (order) url += `&order=${order}`
  if (limit) url += `&limit=${limit}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      'Range-Unit': 'items',
      'Range': '0-999',
      'Prefer': 'count=none',
    },
  })
  return res.json()
}

// ─── STYLES ────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#040406',
    color: '#EEEEF5',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: '14px',
  } as React.CSSProperties,
  login: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    background: '#040406',
    position: 'relative',
    overflow: 'hidden',
  } as React.CSSProperties,
  loginBox: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: '16px',
    padding: '48px',
    width: '380px',
    position: 'relative',
    zIndex: 1,
  } as React.CSSProperties,
  glow: {
    position: 'absolute' as const,
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none' as const,
  },
  nav: {
    background: '#0A0A0D',
    borderBottom: '1px solid #1C1C26',
    padding: '14px 28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  },
  main: { maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' },
  card: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: '12px', padding: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '13px' },
  th: { textAlign: 'left' as const, padding: '10px 14px', color: '#6A6A82', fontSize: '11px', textTransform: 'uppercase' as const, letterSpacing: '1px', borderBottom: '1px solid #1C1C26', fontWeight: 600 },
  td: { padding: '12px 14px', borderBottom: '1px solid #0F0F14', color: '#EEEEF5' },
  badge: (color: string) => ({
    display: 'inline-block',
    background: `${color}18`,
    border: `1px solid ${color}44`,
    color,
    borderRadius: '99px',
    padding: '2px 10px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'monospace',
  }),
  tab: (active: boolean) => ({
    padding: '8px 18px',
    borderRadius: '8px',
    background: active ? '#39FF14' : 'transparent',
    color: active ? '#040406' : '#6A6A82',
    border: active ? 'none' : '1px solid #1C1C26',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400,
    fontSize: '13px',
    fontFamily: "'DM Sans', sans-serif",
  }),
  input: {
    width: '100%',
    background: '#0A0A0D',
    border: '1px solid #1C1C26',
    borderRadius: '8px',
    color: '#EEEEF5',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    marginBottom: '16px',
    boxSizing: 'border-box' as const,
  },
}

type Tab = 'overview' | 'users' | 'courts' | 'ratings' | 'feed' | 'qr'

export default function Admin() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(false)

  // Data
  const [stats, setStats] = useState({ users: 0, courts: 0, games: 0, ratings: 0 })
  const [users, setUsers] = useState<any[]>([])
  const [courts, setCourts] = useState<any[]>([])
  const [pendingCourts, setPendingCourts] = useState<any[]>([])
  const [ratings, setRatings] = useState<any[]>([])
  const [posts, setPosts] = useState<any[]>([])

  // QR campaign tracker
  const campaigns = [
    { key: 'default', label: 'Default / Beta', url: '/qr?c=default' },
    { key: 'rucker', label: 'Rucker Park', url: '/qr?c=rucker' },
    { key: 'dyckman', label: 'Dyckman Park', url: '/qr?c=dyckman' },
    { key: 'west4', label: 'West 4th Street', url: '/qr?c=west4' },
    { key: 'flyer', label: 'Flyer / Print', url: '/qr?c=flyer' },
    { key: 'instagram', label: 'Instagram Bio', url: '/qr?c=instagram' },
  ]

  function login() {
    if (pw === TEAM_PASSWORD) {
      setAuthed(true)
      loadData()
    } else {
      setError('Wrong password')
      setTimeout(() => setError(''), 2000)
    }
  }

  async function loadData() {
    setLoading(true)
    try {
      const [u, c, pending, r, p] = await Promise.all([
        supabase('profiles', 'id,username,full_name,netr_score,created_at', 'created_at.desc', 50),
        supabase('courts', 'id,name,city,verified,surface,created_at', 'created_at.desc', 10000),
        supabase('courts', 'id,name,city,submitted_by,created_at', 'created_at.desc,verified.eq.false', 10000),
        supabase('ratings', 'id,rater_id,rated_id,overall_score,created_at', 'created_at.desc', 50),
        supabase('feed_posts', 'id,author_id,content,created_at', 'created_at.desc', 30),
      ])

      if (Array.isArray(u)) {
        setUsers(u)
        setStats(s => ({ ...s, users: u.length }))
      }
      if (Array.isArray(c)) {
        setCourts(c)
        setStats(s => ({ ...s, courts: c.length }))
        setPendingCourts(c.filter((ct: any) => !ct.verified))
      }
      if (Array.isArray(r)) {
        setRatings(r)
        setStats(s => ({ ...s, ratings: r.length }))
      }
      if (Array.isArray(p)) setPosts(p)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  async function approveCourt(id: string) {
    await fetch(`${SUPABASE_URL}/rest/v1/courts?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ verified: true }),
    })
    setPendingCourts(p => p.filter(c => c.id !== id))
  }

  if (!authed) {
    return (
      <>
        <Head>
          <title>NETR · Team Admin</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <div style={S.login}>
          <div style={S.glow} />
          <div style={S.loginBox}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '40px', color: '#39FF14', textShadow: '0 0 16px rgba(57,255,20,0.4)', marginBottom: '4px' }}>NETR</div>
            <div style={{ fontSize: '11px', color: '#6A6A82', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: 'monospace', marginBottom: '36px' }}>TEAM ADMIN</div>

            <label style={{ display: 'block', fontSize: '11px', color: '#6A6A82', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '8px' }}>Password</label>
            <input
              type="password"
              placeholder="Enter team password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && login()}
              style={S.input}
              autoFocus
            />

            <button
              onClick={login}
              style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: '10px', color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '18px', letterSpacing: '1px', cursor: 'pointer', boxShadow: '0 8px 24px rgba(57,255,20,0.3)' }}
            >
              SIGN IN
            </button>

            {error && <div style={{ color: '#FF4545', textAlign: 'center', marginTop: '12px', fontSize: '13px' }}>{error}</div>}

            <div style={{ marginTop: '24px', fontSize: '12px', color: '#2E2E3A', textAlign: 'center', fontFamily: 'monospace' }}>
              Team access only · netr.pro/admin
            </div>
          </div>
        </div>
      </>
    )
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'users', label: 'Users', icon: '👥' },
    { key: 'courts', label: `Courts${pendingCourts.length > 0 ? ` (${pendingCourts.length} pending)` : ''}`, icon: '🏀' },
    { key: 'ratings', label: 'Ratings', icon: '⭐' },
    { key: 'feed', label: 'Feed', icon: '📢' },
    { key: 'qr', label: 'QR Campaigns', icon: '📷' },
  ]

  return (
    <>
      <Head>
        <title>NETR Admin</title>
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div style={S.page}>
        {/* Nav */}
        <div style={S.nav}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '24px', color: '#39FF14', textShadow: '0 0 10px rgba(57,255,20,0.4)' }}>NETR</span>
            <span style={{ fontSize: '11px', color: '#6A6A82', fontFamily: 'monospace', letterSpacing: '2px' }}>ADMIN</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {loading && <span style={{ fontSize: '12px', color: '#6A6A82' }}>Loading...</span>}
            <button onClick={loadData} style={{ fontSize: '12px', color: '#39FF14', background: 'none', border: '1px solid #39FF1433', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>↻ Refresh</button>
            <button onClick={() => setAuthed(false)} style={{ fontSize: '12px', color: '#6A6A82', background: 'none', border: '1px solid #1C1C26', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer' }}>Sign Out</button>
          </div>
        </div>

        {/* Tab Bar */}
        <div style={{ background: '#0A0A0D', borderBottom: '1px solid #1C1C26', padding: '12px 24px', display: 'flex', gap: '8px', overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={S.tab(tab === t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={S.main}>

          {/* ── OVERVIEW ── */}
          {tab === 'overview' && (
            <>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', marginBottom: '24px', color: '#EEEEF5' }}>Dashboard Overview</h2>
              <div style={S.grid}>
                {[
                  { label: 'Total Users', value: users.length, color: '#39FF14', icon: '👥' },
                  { label: 'Total Courts', value: courts.length, color: '#4A9EFF', icon: '📍' },
                  { label: 'Pending Courts', value: pendingCourts.length, color: '#F5C542', icon: '⏳' },
                  { label: 'Total Ratings', value: ratings.length, color: '#9B6DFF', icon: '⭐' },
                  { label: 'Feed Posts', value: posts.length, color: '#FF8C00', icon: '📢' },
                ].map(s => (
                  <div key={s.label} style={{ ...S.card, borderColor: `${s.color}22` }}>
                    <div style={{ fontSize: '24px', marginBottom: '8px' }}>{s.icon}</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '40px', color: s.color, lineHeight: 1, textShadow: `0 0 12px ${s.color}44` }}>{s.value}</div>
                    <div style={{ fontSize: '12px', color: '#6A6A82', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recent users */}
              <div style={S.card}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', marginBottom: '16px', color: '#EEEEF5' }}>Recent Signups</div>
                <table style={S.table}>
                  <thead>
                    <tr>
                      {['Username', 'Name', 'NETR Score', 'Joined'].map(h => <th key={h} style={S.th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {users.slice(0, 8).map((u, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0A0D' }}>
                        <td style={S.td}><span style={{ color: '#39FF14', fontFamily: 'monospace' }}>@{u.username || '—'}</span></td>
                        <td style={S.td}>{u.full_name || '—'}</td>
                        <td style={S.td}>
                          <span style={S.badge('#39FF14')}>{u.netr_score?.toFixed(1) || '—'}</span>
                        </td>
                        <td style={{ ...S.td, color: '#6A6A82' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── USERS ── */}
          {tab === 'users' && (
            <div style={S.card}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '22px', marginBottom: '16px' }}>All Users</div>
              <table style={S.table}>
                <thead>
                  <tr>{['Username', 'Name', 'NETR Score', 'Joined'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0A0D' }}>
                      <td style={S.td}><span style={{ color: '#39FF14', fontFamily: 'monospace' }}>@{u.username || '—'}</span></td>
                      <td style={S.td}>{u.full_name || '—'}</td>
                      <td style={S.td}><span style={S.badge('#39FF14')}>{u.netr_score?.toFixed(1) || '—'}</span></td>
                      <td style={{ ...S.td, color: '#6A6A82' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── COURTS ── */}
          {tab === 'courts' && (
            <>
              {pendingCourts.length > 0 && (
                <div style={{ ...S.card, borderColor: '#F5C54233', marginBottom: '24px' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '20px', color: '#F5C542', marginBottom: '16px' }}>
                    ⏳ Pending Approval ({pendingCourts.length})
                  </div>
                  <table style={S.table}>
                    <thead>
                      <tr>{['Court Name', 'City', 'Submitted', 'Action'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {pendingCourts.map((c, i) => (
                        <tr key={i}>
                          <td style={S.td}>{c.name}</td>
                          <td style={S.td}>{c.city}</td>
                          <td style={{ ...S.td, color: '#6A6A82' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                          <td style={S.td}>
                            <button onClick={() => approveCourt(c.id)} style={{ background: '#39FF1420', border: '1px solid #39FF1444', color: '#39FF14', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer', fontSize: '12px' }}>
                              ✓ Approve
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div style={S.card}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '20px', marginBottom: '16px' }}>All Courts ({courts.length})</div>
                <table style={S.table}>
                  <thead>
                    <tr>{['Name', 'City', 'Surface', 'Status', 'Added'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {courts.map((c, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0A0D' }}>
                        <td style={S.td}>{c.name}</td>
                        <td style={S.td}>{c.city}</td>
                        <td style={S.td}>{c.surface || '—'}</td>
                        <td style={S.td}>
                          <span style={S.badge(c.verified ? '#39FF14' : '#F5C542')}>{c.verified ? '✓ Verified' : 'Pending'}</span>
                        </td>
                        <td style={{ ...S.td, color: '#6A6A82' }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── RATINGS ── */}
          {tab === 'ratings' && (
            <div style={S.card}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '20px', marginBottom: '16px' }}>Recent Ratings</div>
              <table style={S.table}>
                <thead>
                  <tr>{['Rater', 'Rated Player', 'Score', 'Date'].map(h => <th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {ratings.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : '#0A0A0D' }}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '12px', color: '#6A6A82' }}>{r.rater_id?.slice(0, 8)}...</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '12px', color: '#6A6A82' }}>{r.rated_id?.slice(0, 8)}...</td>
                      <td style={S.td}><span style={S.badge(r.overall_score >= 7 ? '#39FF14' : r.overall_score >= 4 ? '#F5C542' : '#FF4545')}>{r.overall_score?.toFixed(1) || '—'}</span></td>
                      <td style={{ ...S.td, color: '#6A6A82' }}>{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── FEED ── */}
          {tab === 'feed' && (
            <div style={S.card}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '20px', marginBottom: '16px' }}>Recent Feed Posts</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {posts.map((p, i) => (
                  <div key={i} style={{ background: '#0A0A0D', borderRadius: '8px', padding: '14px 16px', border: '1px solid #1C1C26' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6A6A82' }}>{p.author_id?.slice(0, 12)}...</span>
                      <span style={{ fontSize: '11px', color: '#6A6A82' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#EEEEF5' }}>{p.content || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── QR CAMPAIGNS ── */}
          {tab === 'qr' && (
            <>
              <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '28px', marginBottom: '8px' }}>QR Campaigns</h2>
              <p style={{ color: '#6A6A82', marginBottom: '28px', fontSize: '14px' }}>
                Each campaign has a unique QR code and landing page. Print, post, and share.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                {campaigns.map(camp => {
                  const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${camp.url}` : camp.url
                  const qrImg = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(fullUrl)}&bgcolor=0F0F14&color=39FF14&margin=8`
                  return (
                    <div key={camp.key} style={{ ...S.card, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={qrImg} alt={camp.label} width={120} height={120} style={{ borderRadius: '8px', marginBottom: '14px', border: '1px solid #1C1C26' }} />
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '16px', marginBottom: '4px' }}>{camp.label}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6A6A82', marginBottom: '16px' }}>/qr?c={camp.key}</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        <a href={camp.url} target="_blank" rel="noopener noreferrer"
                          style={{ background: '#39FF1420', border: '1px solid #39FF1444', color: '#39FF14', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', textDecoration: 'none' }}>
                          Preview
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(fullUrl)}
                          style={{ background: '#1C1C26', border: '1px solid #2E2E3A', color: '#6A6A82', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>
                          Copy URL
                        </button>
                        <a href={qrImg.replace('160x160', '800x800')} download={`netr-qr-${camp.key}.png`}
                          style={{ background: '#1C1C26', border: '1px solid #2E2E3A', color: '#6A6A82', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer', textDecoration: 'none' }}>
                          ↓ PNG
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ ...S.card, marginTop: '24px', borderColor: '#4A9EFF22' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '18px', marginBottom: '8px', color: '#4A9EFF' }}>📷 How to Use QR Codes</div>
                <div style={{ color: '#6A6A82', fontSize: '13px', lineHeight: 1.8 }}>
                  <strong style={{ color: '#EEEEF5' }}>Courts:</strong> Print the court-specific QR (Rucker, Dyckman, West 4th) and tape to the fence or hoop post.<br />
                  <strong style={{ color: '#EEEEF5' }}>Flyers:</strong> Use the Flyer campaign for any printed materials — posters, stickers, merch hangtags.<br />
                  <strong style={{ color: '#EEEEF5' }}>Instagram:</strong> Link in bio → /qr?c=instagram for anyone coming from social.<br />
                  <strong style={{ color: '#EEEEF5' }}>Preview:</strong> Each QR page auto-detects mobile and redirects to TestFlight after 1 second.<br />
                  <strong style={{ color: '#EEEEF5' }}>Download:</strong> Hit "↓ PNG" to get a high-res 800×800px QR for print use.
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  )
}
