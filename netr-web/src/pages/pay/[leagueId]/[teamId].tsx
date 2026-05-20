import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

type League = {
  id: string
  name: string
  logo_url: string | null
  accent_color: string | null
  fee_amount: number | null
  payment_modes_enabled: string[]
  installment_count: number
  installment_interval: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
}

type Team = {
  id: string
  name: string
  color: string
  logo_url: string | null
  fee_paid: boolean
  payment_mode: string | null
  installments_paid: number
  installments_total: number | null
}

type PlayerPayment = {
  id: string
  player_name: string
  player_email: string | null
  amount_cents: number
  paid_at: string | null
}

export default function PayPage() {
  const router = useRouter()
  const { leagueId, teamId } = router.query as { leagueId: string; teamId: string }
  const { success, cancelled, plan: isPlan, player: isPlayer } = router.query

  const [league, setLeague] = useState<League | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [playerPayments, setPlayerPayments] = useState<PlayerPayment[]>([])
  const [rosterSize, setRosterSize] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedMode, setSelectedMode] = useState<'full' | 'split' | 'plan' | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId || !teamId) return
    Promise.all([
      supabase.from('leagues')
        .select('id,name,logo_url,accent_color,fee_amount,payment_modes_enabled,installment_count,installment_interval,stripe_account_id,stripe_onboarding_complete')
        .eq('id', leagueId).single(),
      supabase.from('league_teams')
        .select('id,name,color,logo_url,fee_paid,payment_mode,installments_paid,installments_total')
        .eq('id', teamId).eq('league_id', leagueId).single(),
      supabase.from('league_player_payments')
        .select('id,player_name,player_email,amount_cents,paid_at')
        .eq('team_id', teamId).order('created_at'),
      supabase.from('league_players')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', teamId),
    ]).then(([lRes, tRes, pRes, rRes]) => {
      setLeague(lRes.data as League | null)
      setTeam(tRes.data as Team | null)
      setPlayerPayments((pRes.data as PlayerPayment[]) ?? [])
      setRosterSize(rRes.count ?? 1)
      const modes = (lRes.data?.payment_modes_enabled as string[]) ?? []
      if (modes.length === 1) setSelectedMode(modes[0] as 'full' | 'split' | 'plan')
      setLoading(false)
    })
  }, [leagueId, teamId])

  async function startPayment(mode: 'full' | 'split' | 'plan') {
    if (!league || !team) return
    if (mode === 'split' && !playerName.trim()) {
      setError('Please enter your name')
      return
    }
    setPaying(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId, teamId, mode, playerName: playerName.trim(), playerEmail: playerEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Failed to start checkout')
        setPaying(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setPaying(false)
    }
  }

  if (loading) return <Shell><div style={S.center}><span style={S.loading}>LOADING…</span></div></Shell>
  if (!league || !team) return <Shell><div style={S.center}><span style={S.error}>Payment link not found.</span></div></Shell>

  const accent = league.accent_color ?? '#39FF14'
  const modes = league.payment_modes_enabled ?? []
  const feeCents = Math.round((league.fee_amount ?? 0) * 100)
  const shareAmount = rosterSize > 0 ? feeCents / rosterSize : feeCents
  const installmentCount = league.installment_count ?? 3
  const installmentAmount = feeCents / installmentCount
  const paidPlayerCount = playerPayments.filter(p => p.paid_at).length

  const notReady = !league.stripe_account_id || !league.stripe_onboarding_complete

  // Success state
  if (success === '1') {
    return (
      <Shell league={league}>
        <div style={S.card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <h2 style={{ ...S.h2, color: accent }}>Payment Received!</h2>
          {isPlan === '1' ? (
            <p style={S.body}>Your payment plan is set up. You'll be billed automatically each {league.installment_interval} until all {installmentCount} payments are complete.</p>
          ) : isPlayer === '1' ? (
            <p style={S.body}>Your share of the team fee has been paid. {paidPlayerCount} of {rosterSize} players have paid so far.</p>
          ) : (
            <p style={S.body}>The full league fee for <strong>{team.name}</strong> has been paid. You're all set for the season!</p>
          )}
          <p style={S.muted}>Questions? Contact your league organizer.</p>
        </div>
      </Shell>
    )
  }

  // Cancelled state
  if (cancelled === '1') {
    return (
      <Shell league={league}>
        <div style={S.card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>↩</div>
          <h2 style={S.h2}>Payment cancelled</h2>
          <p style={S.body}>No charge was made. You can try again whenever you're ready.</p>
          <button onClick={() => router.replace({ query: { leagueId, teamId } })} style={{ ...S.btn, background: accent, color: '#040406', marginTop: 24 }}>
            Try Again
          </button>
        </div>
      </Shell>
    )
  }

  // Already fully paid
  if (team.fee_paid && team.payment_mode !== 'split') {
    return (
      <Shell league={league}>
        <div style={S.card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
          <h2 style={{ ...S.h2, color: accent }}>All paid!</h2>
          <p style={S.body}><strong>{team.name}</strong> is fully paid up for the season. Nothing left to do here.</p>
        </div>
      </Shell>
    )
  }

  // No Stripe connected
  if (notReady || !league.fee_amount || modes.length === 0) {
    return (
      <Shell league={league}>
        <div style={S.card}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
          <h2 style={S.h2}>Payments not set up yet</h2>
          <p style={S.body}>The league organizer hasn't finished setting up online payments. Check back soon or contact them directly.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell league={league}>
      <div style={S.card}>
        {/* Team header */}
        <div style={S.teamHeader}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
          <span style={S.teamName}>{team.name}</span>
        </div>
        <div style={S.leagueName}>{league.name}</div>

        <div style={{ ...S.divider, borderColor: `${accent}30` }} />

        {/* Mode selector (only if multiple modes) */}
        {modes.length > 1 && !selectedMode && (
          <div>
            <p style={S.label}>How would you like to pay?</p>
            <div style={S.modeGrid}>
              {modes.includes('full') && (
                <button onClick={() => setSelectedMode('full')} style={S.modeBtn}>
                  <div style={S.modeIcon}>💳</div>
                  <div style={S.modeTitle}>Pay in Full</div>
                  <div style={S.modeSub}>${((feeCents) / 100).toFixed(2)} once</div>
                </button>
              )}
              {modes.includes('split') && (
                <button onClick={() => setSelectedMode('split')} style={S.modeBtn}>
                  <div style={S.modeIcon}>👥</div>
                  <div style={S.modeTitle}>Split with Team</div>
                  <div style={S.modeSub}>${(shareAmount / 100).toFixed(2)} each · {rosterSize} players</div>
                </button>
              )}
              {modes.includes('plan') && (
                <button onClick={() => setSelectedMode('plan')} style={S.modeBtn}>
                  <div style={S.modeIcon}>📅</div>
                  <div style={S.modeTitle}>Payment Plan</div>
                  <div style={S.modeSub}>{installmentCount}× ${(installmentAmount / 100).toFixed(2)}/{league.installment_interval}</div>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Full payment UI */}
        {selectedMode === 'full' && (
          <div>
            <div style={S.amountBlock}>
              <div style={{ ...S.amount, color: accent }}>${((feeCents) / 100).toFixed(2)}</div>
              <div style={S.amountLabel}>Total league fee — one payment</div>
            </div>
            {error && <div style={S.errorMsg}>{error}</div>}
            <button onClick={() => startPayment('full')} disabled={paying} style={{ ...S.btn, background: accent, color: '#040406', opacity: paying ? 0.6 : 1 }}>
              {paying ? 'Redirecting…' : `Pay $${((feeCents) / 100).toFixed(2)}`}
            </button>
            {modes.length > 1 && <button onClick={() => setSelectedMode(null)} style={S.back}>← Change payment method</button>}
          </div>
        )}

        {/* Split payment UI */}
        {selectedMode === 'split' && (
          <div>
            <div style={S.amountBlock}>
              <div style={{ ...S.amount, color: accent }}>${(shareAmount / 100).toFixed(2)}</div>
              <div style={S.amountLabel}>Your share · {rosterSize} players × ${((feeCents) / 100).toFixed(2)} total</div>
            </div>

            {/* Who's paid */}
            {playerPayments.length > 0 && (
              <div style={S.paidList}>
                <div style={S.paidHeader}>{paidPlayerCount}/{rosterSize} paid</div>
                {playerPayments.filter(p => p.paid_at).map(p => (
                  <div key={p.id} style={S.paidRow}>
                    <span style={{ color: accent }}>✓</span> {p.player_name}
                  </div>
                ))}
              </div>
            )}

            {team.fee_paid ? (
              <div style={{ ...S.successMsg }}>✅ All players have paid — team is fully paid up!</div>
            ) : (
              <>
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>Your name *</label>
                  <input
                    value={playerName}
                    onChange={e => setPlayerName(e.target.value)}
                    placeholder="First Last"
                    style={S.input}
                  />
                </div>
                <div style={S.fieldGroup}>
                  <label style={S.fieldLabel}>Email (optional — for receipt)</label>
                  <input
                    type="email"
                    value={playerEmail}
                    onChange={e => setPlayerEmail(e.target.value)}
                    placeholder="you@example.com"
                    style={S.input}
                  />
                </div>
                {error && <div style={S.errorMsg}>{error}</div>}
                <button onClick={() => startPayment('split')} disabled={paying} style={{ ...S.btn, background: accent, color: '#040406', opacity: paying ? 0.6 : 1 }}>
                  {paying ? 'Redirecting…' : `Pay my share — $${(shareAmount / 100).toFixed(2)}`}
                </button>
              </>
            )}
            {modes.length > 1 && <button onClick={() => setSelectedMode(null)} style={S.back}>← Change payment method</button>}
          </div>
        )}

        {/* Payment plan UI */}
        {selectedMode === 'plan' && (
          <div>
            <div style={S.amountBlock}>
              <div style={{ ...S.amount, color: accent }}>${(installmentAmount / 100).toFixed(2)}<span style={{ fontSize: 18, fontWeight: 400 }}>/{league.installment_interval}</span></div>
              <div style={S.amountLabel}>{installmentCount} payments · ${((feeCents) / 100).toFixed(2)} total</div>
            </div>

            {/* Installment progress (if plan already started) */}
            {team.payment_mode === 'plan' && (team.installments_paid ?? 0) > 0 && (
              <div style={S.paidList}>
                <div style={S.paidHeader}>{team.installments_paid}/{team.installments_total ?? installmentCount} installments paid</div>
                <div style={{ background: '#14141C', borderRadius: 6, height: 6, overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ height: '100%', background: accent, width: `${((team.installments_paid ?? 0) / (team.installments_total ?? installmentCount)) * 100}%`, borderRadius: 6 }} />
                </div>
              </div>
            )}

            <div style={S.planBreakdown}>
              {Array.from({ length: installmentCount }, (_, i) => (
                <div key={i} style={S.planRow}>
                  <span style={S.planNum}>Payment {i + 1}</span>
                  <span style={{ color: (team.installments_paid ?? 0) > i ? accent : '#EEEEF5' }}>
                    {(team.installments_paid ?? 0) > i ? '✓ Paid' : `$${(installmentAmount / 100).toFixed(2)}`}
                  </span>
                </div>
              ))}
            </div>

            {team.payment_mode !== 'plan' && (
              <>
                {error && <div style={S.errorMsg}>{error}</div>}
                <button onClick={() => startPayment('plan')} disabled={paying} style={{ ...S.btn, background: accent, color: '#040406', opacity: paying ? 0.6 : 1 }}>
                  {paying ? 'Redirecting…' : `Start Plan — $${(installmentAmount / 100).toFixed(2)}/mo`}
                </button>
                <p style={S.muted}>Your card will be charged automatically each {league.installment_interval}. Cancel anytime before the next payment.</p>
              </>
            )}
            {modes.length > 1 && <button onClick={() => setSelectedMode(null)} style={S.back}>← Change payment method</button>}
          </div>
        )}

        <div style={{ ...S.divider, borderColor: '#14141C', marginTop: 32 }} />
        <p style={{ ...S.muted, fontSize: 11, textAlign: 'center' as const }}>
          Payments processed by Stripe · NETR is the platform host and does not collect any fees
        </p>
      </div>
    </Shell>
  )
}

function Shell({ children, league }: { children: React.ReactNode; league?: League | null }) {
  const accent = league?.accent_color ?? '#39FF14'
  return (
    <>
      <Head>
        <title>{league ? `Pay — ${league.name}` : 'League Payment'} — NETR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={S.page}>
        <header style={S.header}>
          {league?.logo_url && <img src={league.logo_url} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover' }} />}
          <span style={{ ...S.logo, color: accent }}>NETR</span>
          <span style={S.logoSub}>LEAGUES</span>
        </header>
        <main style={S.main}>{children}</main>
      </div>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5' },
  header: { borderBottom: '1px solid #14141C', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', gap: 10, background: '#0A0A0E' },
  logo: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, lineHeight: 1 },
  logoSub: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: '#EEEEF5' },
  main: { maxWidth: 480, margin: '40px auto', padding: '0 20px 60px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' },
  loading: { fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: '#39FF14', letterSpacing: 2 },
  error: { color: '#FF453A', fontSize: 16 },

  card: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 16, padding: '28px 24px' },
  teamHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  leagueName: { fontSize: 13, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },
  divider: { borderTop: '1px solid', margin: '20px 0' },

  h2: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 32, margin: '0 0 12px', textTransform: 'uppercase' as const },
  body: { fontSize: 15, color: '#EEEEF5', lineHeight: 1.6, margin: '0 0 16px' },
  muted: { fontSize: 13, color: '#6A6A82', lineHeight: 1.5 },
  label: { fontSize: 13, color: '#6A6A82', marginBottom: 14 },

  modeGrid: { display: 'flex', flexDirection: 'column' as const, gap: 10 },
  modeBtn: {
    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px',
    background: '#14141C', border: '1px solid #2E2E3A', borderRadius: 12,
    cursor: 'pointer', textAlign: 'left' as const, color: '#EEEEF5', width: '100%',
  },
  modeIcon: { fontSize: 24, flexShrink: 0 },
  modeTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  modeSub: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginTop: 2 },

  amountBlock: { textAlign: 'center' as const, padding: '24px 0 20px' },
  amount: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 52, lineHeight: 1 },
  amountLabel: { fontSize: 13, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginTop: 6 },

  btn: {
    width: '100%', padding: '16px', border: 'none', borderRadius: 10,
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20,
    textTransform: 'uppercase' as const, letterSpacing: 1, cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  back: {
    background: 'transparent', border: 'none', color: '#6A6A82',
    fontSize: 13, cursor: 'pointer', marginTop: 14, padding: 0,
    fontFamily: "'DM Mono', monospace",
  },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { display: 'block', fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
  input: {
    width: '100%', background: '#0A0A0D', border: '1px solid #2E2E3A', borderRadius: 8,
    color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 15, padding: '12px 14px',
    outline: 'none', boxSizing: 'border-box' as const,
  },

  paidList: { background: '#14141C', borderRadius: 10, padding: '14px 16px', marginBottom: 20 },
  paidHeader: { fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginBottom: 8 },
  paidRow: { fontSize: 14, padding: '4px 0', display: 'flex', gap: 8 },

  planBreakdown: { marginBottom: 20 },
  planRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #14141C', fontSize: 14 },
  planNum: { color: '#6A6A82', fontFamily: "'DM Mono', monospace" },

  errorMsg: { background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', color: '#FF453A', borderRadius: 8, padding: '10px 14px', fontSize: 14, marginBottom: 14 },
  successMsg: { background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.3)', color: '#39FF14', borderRadius: 8, padding: '12px 16px', fontSize: 14 },
}
