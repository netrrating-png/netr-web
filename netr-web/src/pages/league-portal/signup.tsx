import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LeaguePortalSignup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
    return (
      <>
        <Head>
          <title>Check your email — NETR League Portal</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div style={S.page}>
          <div style={S.glow} />
          <div style={S.card}>
            <div style={S.logo}>NETR</div>
            <div style={S.sub}>LEAGUE PORTAL</div>
            <div style={S.doneIcon}>✉️</div>
            <h2 style={S.doneTitle}>Check your email</h2>
            <p style={S.doneSub}>
              We sent a confirmation link to <strong style={{ color: '#EEEEF5' }}>{email}</strong>.
              Click it to activate your account, then sign in.
            </p>
            <a href="/league-portal/login" style={S.btn}>Go to Sign In</a>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Create Account — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <div style={S.glow} />
        <div style={S.card}>
          <div style={S.logo}>NETR</div>
          <div style={S.sub}>CREATE COMMISSIONER ACCOUNT</div>

          <form onSubmit={handleSignup}>
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
              placeholder="Min. 8 characters"
              required
            />

            <label style={S.label}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={S.input}
              placeholder="••••••••"
              required
            />

            {error && <div style={S.error}>{error}</div>}

            <button type="submit" style={S.btn} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div style={S.footer}>
            Already have an account?{' '}
            <a href="/league-portal/login" style={S.link}>Sign in</a>
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
    display: 'block',
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
    textAlign: 'center' as const,
    textDecoration: 'none',
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
  doneIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  doneTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontSize: 28,
    fontWeight: 900,
    color: '#EEEEF5',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
  },
  doneSub: {
    fontSize: 14,
    color: '#6A6A82',
    lineHeight: 1.6,
    marginBottom: 28,
  },
}
