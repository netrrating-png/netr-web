import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export default function NewLeague() {
  const router = useRouter()
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [season, setSeason] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/league-portal/login')
      else setUserId(user.id)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const baseSlug = toSlug(name)
    const slug = baseSlug + '-' + Math.random().toString(36).slice(2, 6)

    const { data, error } = await supabase
      .from('leagues')
      .insert({ owner_id: userId, name, slug, season: season || null, location: location || null, description: description || null })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push(`/league-portal/${data.id}`)
    }
  }

  return (
    <>
      <Head>
        <title>New League — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <nav style={S.nav}>
          <div style={S.navInner}>
            <a href="/league-portal" style={S.backLink}>← My Leagues</a>
            <span style={S.logo}>NETR <span style={{ color: '#EEEEF5', opacity: 0.6 }}>LEAGUES</span></span>
          </div>
        </nav>

        <main style={S.main}>
          <div style={S.glow} />
          <div style={S.card}>
            <h1 style={S.title}>Create New League</h1>
            <p style={S.sub}>Set up your league info. You can edit this later.</p>

            <form onSubmit={handleCreate}>
              <label style={S.label}>League Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                style={S.input}
                placeholder="e.g. Monday Night Hoops"
                required
                autoFocus
              />

              <label style={S.label}>Season</label>
              <input
                type="text"
                value={season}
                onChange={e => setSeason(e.target.value)}
                style={S.input}
                placeholder="e.g. Summer 2026"
              />

              <label style={S.label}>Location / Gym</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={S.input}
                placeholder="e.g. Rucker Park, Harlem NY"
              />

              <label style={S.label}>Description (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ ...S.input, height: 90, resize: 'vertical' as const }}
                placeholder="Tell players a bit about this league…"
              />

              {error && <div style={S.error}>{error}</div>}

              <div style={S.actions}>
                <a href="/league-portal" style={S.cancelBtn}>Cancel</a>
                <button type="submit" style={S.submitBtn} disabled={loading || !name}>
                  {loading ? 'Creating…' : 'Create League'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </>
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
  backLink: {
    color: '#6A6A82',
    fontSize: 14,
    textDecoration: 'none',
    fontFamily: "'DM Mono', monospace",
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 22,
    color: '#39FF14',
  },
  main: {
    maxWidth: 600,
    margin: '0 auto',
    padding: '48px 24px',
    position: 'relative' as const,
  },
  glow: {
    position: 'absolute' as const,
    width: 500,
    height: 500,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'none' as const,
  },
  card: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 16,
    padding: '40px',
    position: 'relative' as const,
    zIndex: 1,
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 32,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  sub: {
    color: '#6A6A82',
    fontSize: 14,
    marginBottom: 32,
  },
  label: {
    display: 'block',
    fontSize: 11,
    color: '#6A6A82',
    textTransform: 'uppercase' as const,
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    background: '#0A0A0D',
    border: '1px solid #1C1C26',
    borderRadius: 8,
    color: '#EEEEF5',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 15,
    padding: '12px 16px',
    marginBottom: 24,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  error: {
    color: '#FF4545',
    fontSize: 13,
    marginBottom: 16,
  },
  actions: {
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #2E2E3A',
    borderRadius: 8,
    color: '#6A6A82',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 16,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '12px 24px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  submitBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    border: 'none',
    borderRadius: 8,
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '12px 32px',
    cursor: 'pointer',
  },
}
