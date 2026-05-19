import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, LeagueTeam, League, LeaguePlayer } from '../../lib/supabase'

export default function JoinTeamPage() {
  const router = useRouter()
  const { teamToken } = router.query as { teamToken: string }

  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [team, setTeam] = useState<LeagueTeam | null>(null)
  const [league, setLeague] = useState<League | null>(null)
  const [players, setPlayers] = useState<LeaguePlayer[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<LeaguePlayer | null>(null)
  const [step, setStep] = useState<'roster' | 'auth' | 'done'>('roster')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  useEffect(() => {
    if (!teamToken) return
    async function load() {
      const { data: teamData } = await supabase
        .from('league_teams')
        .select('*')
        .eq('join_token', teamToken)
        .single()

      if (!teamData) { setNotFound(true); setLoading(false); return }

      const [leagueRes, playersRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', teamData.league_id).single(),
        supabase.from('league_players').select('*').eq('team_id', teamData.id).order('display_name'),
      ])

      setTeam(teamData)
      setLeague(leagueRes.data)
      setPlayers(playersRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [teamToken])

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlayer) return
    setAuthError('')
    setAuthLoading(true)

    let userId: string | null = null

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      userId = data.user?.id ?? null
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setAuthError(error.message); setAuthLoading(false); return }
      userId = data.user?.id ?? null
    }

    if (!userId) { setAuthError('Something went wrong. Please try again.'); setAuthLoading(false); return }

    await supabase
      .from('league_players')
      .update({ profile_id: userId, is_claimed: true })
      .eq('id', selectedPlayer.id)

    // Auto-join the team's crew chat so it appears in the player's Messages tab
    if (team?.crew_id) {
      await supabase
        .from('crew_members')
        .upsert(
          { crew_id: team.crew_id, user_id: userId, joined_at: new Date().toISOString() },
          { onConflict: 'crew_id,user_id' }
        )
    }

    setPlayers(prev => prev.map(p => p.id === selectedPlayer.id ? { ...p, profile_id: userId, is_claimed: true } : p))
    setAuthLoading(false)
    setStep('done')
  }

  if (loading) return <FullPageMsg msg="LOADING…" />
  if (notFound) return <FullPageMsg msg="TEAM NOT FOUND" sub="This invite link is invalid or has expired." />

  if (step === 'done') {
    return (
      <FullPageMsg
        msg="YOU'RE IN! 🏀"
        sub={`You've claimed your spot on ${team?.name}. Download the NETR app to track your stats, see your schedule, and rate your teammates.`}
        cta={{ label: 'Download NETR', href: process.env.NEXT_PUBLIC_TESTFLIGHT_URL ?? '#' }}
      />
    )
  }

  return (
    <>
      <Head>
        <title>Join {team?.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <div style={S.glow} />

        <div style={S.card}>
          {/* Header */}
          <div style={S.logo}>NETR</div>
          <div style={S.logoSub}>League Invite</div>

          <div style={S.leagueInfo}>
            <div style={S.leagueName}>{league?.name}</div>
            {league?.season && <div style={S.leagueSeason}>{league.season}</div>}
            <div style={S.teamBadge}>
              <div style={{ ...S.teamDot, background: team?.color ?? '#39FF14', boxShadow: `0 0 8px ${team?.color ?? '#39FF14'}66` }} />
              <span style={S.teamName}>{team?.name}</span>
            </div>
          </div>

          {step === 'roster' && (
            <>
              <p style={S.instruction}>Tap your name to claim your roster spot.</p>

              {players.length === 0 ? (
                <p style={S.noPlayers}>No players have been added to this team yet.</p>
              ) : (
                <div style={S.playerList}>
                  {players.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { if (!p.is_claimed) { setSelectedPlayer(p); setStep('auth') } }}
                      style={{
                        ...S.playerRow,
                        opacity: p.is_claimed ? 0.45 : 1,
                        cursor: p.is_claimed ? 'default' : 'pointer',
                        borderColor: selectedPlayer?.id === p.id ? '#39FF14' : '#1C1C26',
                        background: selectedPlayer?.id === p.id ? 'rgba(57,255,20,0.06)' : 'transparent',
                      }}
                      disabled={p.is_claimed}
                    >
                      <div style={S.playerLeft}>
                        {p.jersey_number && <span style={S.jerseyNum}>#{p.jersey_number}</span>}
                        <span style={S.playerName}>{p.display_name}</span>
                        {p.position && <span style={S.pos}>{p.position}</span>}
                      </div>
                      {p.is_claimed
                        ? <span style={S.claimedBadge}>Claimed</span>
                        : <span style={S.tapLabel}>Tap to claim →</span>
                      }
                    </button>
                  ))}
                </div>
              )}

              <p style={S.notListed}>
                Not listed? Ask your team captain to add your name.
              </p>
            </>
          )}

          {step === 'auth' && selectedPlayer && (
            <>
              <div style={S.claimingFor}>
                Claiming spot for: <strong style={{ color: '#EEEEF5' }}>{selectedPlayer.display_name}</strong>
              </div>

              <div style={S.authTabs}>
                <button onClick={() => setAuthMode('signup')} style={{ ...S.authTab, ...(authMode === 'signup' ? S.authTabActive : {}) }}>New to NETR</button>
                <button onClick={() => setAuthMode('signin')} style={{ ...S.authTab, ...(authMode === 'signin' ? S.authTabActive : {}) }}>Already have account</button>
              </div>

              <form onSubmit={handleClaim}>
                <label style={S.label}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={S.input} placeholder="you@example.com" required autoFocus />
                <label style={S.label}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={S.input} placeholder={authMode === 'signup' ? 'Min. 8 characters' : '••••••••'} required />

                {authError && <div style={S.error}>{authError}</div>}

                <button type="submit" style={S.claimBtn} disabled={authLoading}>
                  {authLoading ? 'Claiming…' : authMode === 'signup' ? 'Create Account & Claim Spot' : 'Sign In & Claim Spot'}
                </button>
              </form>

              <button onClick={() => setStep('roster')} style={S.backBtn}>← Back to roster</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function FullPageMsg({ msg, sub, cta }: { msg: string; sub?: string; cta?: { label: string; href: string } }) {
  return (
    <>
      <Head>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#040406', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 32, color: '#39FF14', textShadow: '0 0 20px rgba(57,255,20,0.5)', marginBottom: 16, letterSpacing: 1 }}>{msg}</div>
          {sub && <p style={{ color: '#6A6A82', fontSize: 15, maxWidth: 380, lineHeight: 1.6, margin: '0 auto 24px' }}>{sub}</p>}
          {cta && <a href={cta.href} style={{ display: 'inline-block', background: 'linear-gradient(135deg, #39FF14, #00CC2A)', color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, padding: '14px 32px', borderRadius: 10, textDecoration: 'none' }}>{cta.label}</a>}
        </div>
      </div>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative' as const, overflow: 'hidden' },
  glow: { position: 'absolute' as const, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' as const },
  card: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 20, padding: '40px 36px', width: '100%', maxWidth: 440, position: 'relative' as const, zIndex: 1 },
  logo: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: '#39FF14', textShadow: '0 0 16px rgba(57,255,20,0.5)', marginBottom: 2 },
  logoSub: { fontSize: 10, color: '#6A6A82', letterSpacing: 3, textTransform: 'uppercase' as const, fontFamily: "'DM Mono', monospace", marginBottom: 24 },
  leagueInfo: { borderBottom: '1px solid #1C1C26', paddingBottom: 20, marginBottom: 20 },
  leagueName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  leagueSeason: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginBottom: 10 },
  teamBadge: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#1C1C26', borderRadius: 99, padding: '5px 12px' },
  teamDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  instruction: { fontSize: 14, color: '#EEEEF5', marginBottom: 14 },
  noPlayers: { color: '#6A6A82', fontSize: 14, textAlign: 'center' as const, padding: '20px 0' },
  playerList: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 20 },
  playerRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: '1px solid #1C1C26', borderRadius: 10, padding: '12px 14px', width: '100%', textAlign: 'left' as const, transition: 'border-color 0.15s, background 0.15s', color: '#EEEEF5' },
  playerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  jerseyNum: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 12, minWidth: 26 },
  playerName: { fontWeight: 500, fontSize: 15 },
  pos: { background: '#1C1C26', color: '#6A6A82', fontSize: 10, fontFamily: "'DM Mono', monospace", padding: '2px 7px', borderRadius: 99 },
  claimedBadge: { fontSize: 11, color: '#39FF14', fontFamily: "'DM Mono', monospace", background: 'rgba(57,255,20,0.1)', padding: '2px 8px', borderRadius: 99 },
  tapLabel: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  notListed: { fontSize: 12, color: '#6A6A82', textAlign: 'center' as const },
  claimingFor: { fontSize: 13, color: '#6A6A82', marginBottom: 16, padding: '10px 12px', background: '#1C1C26', borderRadius: 8 },
  authTabs: { display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid #1C1C26' },
  authTab: { flex: 1, background: 'none', border: 'none', color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '10px', cursor: 'pointer', borderBottom: '2px solid transparent' },
  authTabActive: { color: '#39FF14', borderBottomColor: '#39FF14' },
  label: { display: 'block', fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 },
  input: { width: '100%', background: '#0A0A0D', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '11px 14px', marginBottom: 16, outline: 'none', boxSizing: 'border-box' as const },
  error: { color: '#FF4545', fontSize: 13, marginBottom: 12 },
  claimBtn: { width: '100%', background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 10, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '13px', cursor: 'pointer', marginBottom: 14 },
  backBtn: { background: 'none', border: 'none', color: '#6A6A82', fontSize: 13, cursor: 'pointer', fontFamily: "'DM Mono', monospace" },
}
