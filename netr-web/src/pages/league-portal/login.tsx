import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function LeaguePortalLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.replace('/league-portal')
    })
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/league-portal')
    }
  }

  return (
    <>
      <Head>
        <title>League Portal — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <div style={S.glow} />
        <div style={S.card}>
          <div style={S.logo}>NETR</div>
          <div style={S.sub}>LEAGUE PORTAL</div>

          <form onSubmit={handleLogin}>
            <label style={S.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={S.input}
              placeholder="you@example.com"
              required
              autoFocus
            />

            <label style={S.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={S.input}
              placeholder="••••••••"
              required
            />

            {error && <div style={S.error}>{error}</div>}

            <button type="submit" style={S.btn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={S.footer}>
            New commissioner?{' '}
            <a href="/league-portal/signup" style={S.link}>Create account</a>
          </div>
        </div>
      </div>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#040406',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  card: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 16,
    padding: '48px',
    width: 400,
    position: 'relative',
    zIndex: 1,
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 40,
    color: '#39FF14',
    textShadow: '0 0 20px rgba(57,255,20,0.5)',
    marginBottom: 4,
  },
  sub: {
    fontSize: 11,
    color: '#6A6A82',
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    fontFamily: "'DM Mono', monospace",
    marginBottom: 36,
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
    marginBottom: 20,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  error: {
    color: '#FF4545',
    fontSize: 13,
    marginBottom: 16,
  },
  btn: {
    width: '100%',
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    border: 'none',
    borderRadius: 10,
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '14px',
    cursor: 'pointer',
    marginTop: 4,
  },
  footer: {
    marginTop: 24,
    textAlign: 'center' as const,
    fontSize: 14,
    color: '#6A6A82',
  },
  link: {
    color: '#39FF14',
    textDecoration: 'none',
  },
}
