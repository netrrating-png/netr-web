import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

const TESTFLIGHT_URL = 'https://testflight.apple.com/join/REPLACE_ME'

const TIERS = [
  { range: '9.5 – 9.9', label: 'NBA Level', color: '#F5C542', fill: '99%' },
  { range: '9.0 – 9.4', label: 'Elite Pro', color: '#F5C542', fill: '93%' },
  { range: '8.0 – 8.9', label: 'Elite', color: '#30D158', fill: '84%' },
  { range: '7.0 – 7.9', label: 'D3 Level', color: '#39FF14', fill: '74%' },
  { range: '6.0 – 6.9', label: 'Park Legend', color: '#39FF14', fill: '64%' },
  { range: '5.0 – 5.9', label: 'Park Dominant', color: '#4A9EFF', fill: '54%' },
  { range: '4.0 – 4.9', label: 'Above Average', color: '#F5C542', fill: '44%' },
  { range: '3.0 – 3.9', label: 'Recreational', color: '#FF9500', fill: '34%' },
  { range: '1.0 – 2.9', label: 'Just Getting Started', color: '#FF453A', fill: '19%' },
]

export default function Home() {
  const [scrolled, setScrolled] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible')
      })
    }, { threshold: 0.15 })

    document.querySelectorAll('.fade-up').forEach(el => {
      observerRef.current?.observe(el)
    })

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <>
      <Head>
        <title>NETR — Your Rep. Built on the Court.</title>
        <meta name="description" content="DUPR-style basketball peer rating. Rate your game. Build your rep." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="app-layout">
        {/* NAV */}
        <nav id="main-nav" className={scrolled ? 'scrolled' : ''}>
          <div className="container navbar flex justify-between align-center">
            <div className="logo">NETR</div>
            <div className="nav-links flex gap-4 align-center">
              <a href="#how-it-works">How It Works</a>
              <a href="#rating-scale">Rating Scale</a>
              <a href={TESTFLIGHT_URL} style={{
                background: 'var(--color-primary)',
                color: '#040406',
                padding: '8px 20px',
                borderRadius: '999px',
                fontFamily: 'var(--font-heading)',
                fontWeight: 900,
                fontSize: '1rem',
                letterSpacing: '1px'
              }}>GET THE APP</a>
            </div>
          </div>
        </nav>

        <main className="main-content">

          {/* HERO */}
          <section className="hero py-20" style={{ position: 'relative', zIndex: 2 }}>
            {/* Background glow */}
            <div style={{
              position: 'absolute', top: '10%', left: '50%',
              transform: 'translateX(-50%)',
              width: '600px', height: '400px',
              background: 'radial-gradient(ellipse, rgba(57,255,20,0.07) 0%, transparent 70%)',
              pointerEvents: 'none', zIndex: 0
            }} />

            <div className="container text-center" style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)',
                borderRadius: '999px', padding: '6px 16px',
                fontFamily: 'var(--font-mono)', fontSize: '12px',
                color: 'var(--color-primary)', marginBottom: '28px',
                letterSpacing: '2px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block' }} />
                NOW IN BETA · NYC
              </div>

              <h1 className="hero-title mb-8">
                YOUR REP.<br />
                <span className="text-primary">BUILT ON</span><br />
                THE COURT.
              </h1>

              <p className="hero-sub" style={{
                fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                color: 'var(--color-text-sub)',
                maxWidth: '520px',
                margin: '0 auto 40px',
                lineHeight: 1.6
              }}>
                The first peer-to-peer basketball rating system. Rate who you run with.
                Build your verified score. Know where you really stand.
              </p>

              <div className="hero-cta flex gap-4 align-center" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <a href={TESTFLIGHT_URL} className="btn-primary" style={{ fontSize: '1.2rem', padding: '1rem 2.5rem' }}>
                  📲 Download on TestFlight
                </a>
                <a href="#how-it-works" className="btn-secondary">
                  How It Works
                </a>
              </div>

              {/* Score badge showcase */}
              <div className="hero-badge" style={{ marginTop: '64px', display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap' }}>
                {[
                  { score: '9.2', label: 'Elite Pro', color: '#F5C542' },
                  { score: '7.4', label: 'D3 Level', color: '#39FF14' },
                  { score: '5.8', label: 'Park Dominant', color: '#4A9EFF' },
                ].map((b) => (
                  <div key={b.score} style={{ textAlign: 'center' }}>
                    <div className="netr-badge border-4" style={{
                      width: '80px', height: '80px',
                      fontSize: '1.6rem',
                      borderColor: b.color,
                      color: b.color,
                      boxShadow: `0 0 24px ${b.color}66`,
                      textShadow: `0 0 10px ${b.color}`,
                      margin: '0 auto 8px'
                    }}>
                      {b.score}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-sub)', fontFamily: 'var(--font-mono)', letterSpacing: '1px' }}>
                      {b.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* STATS STRIP */}
          <section style={{ borderTop: '1px solid #1C1C24', borderBottom: '1px solid #1C1C24', padding: '32px 0' }}>
            <div className="container">
              <div style={{ display: 'flex', justifyContent: 'center', gap: '64px', flexWrap: 'wrap' }}>
                {[
                  { num: '584+', label: 'Courts in NYC' },
                  { num: '7', label: 'Skill Categories' },
                  { num: '0%', label: 'Self-Rating' },
                  { num: '100%', label: 'Peer Verified' },
                ].map((s) => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: '2.5rem', color: 'var(--color-primary)', textShadow: '0 0 12px rgba(57,255,20,0.4)' }}>
                      {s.num}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-sub)', letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
                      {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section id="how-it-works" className="py-20">
            <div className="container">
              <div className="text-center mb-12">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-primary)', letterSpacing: '3px', marginBottom: '12px' }}>
                  HOW IT WORKS
                </div>
                <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '0' }}>
                  RUN. RATE. REP.
                </h2>
              </div>

              <div className="grid-3" style={{ gap: '20px' }}>
                {[
                  { icon: '🏀', step: '01', title: 'Find a Run', desc: 'Open NETR and find active games at courts near you. Join by QR code or 6-digit join code. Up to 10 players per game.' },
                  { icon: '⭐', step: '02', title: 'Rate Your Teammates', desc: 'After the game, rate every player across 7 categories: Scoring, Defense, Handles, Passing, Athleticism, IQ, and Finishing.' },
                  { icon: '📈', step: '03', title: 'Build Your Score', desc: 'Your NETR score updates after every game. The more you play, the more accurate it gets. No self-rating. Peer verified only.' },
                ].map((s) => (
                  <div key={s.step} className="step-card fade-up card" style={{ borderRadius: '16px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '16px' }}>{s.icon}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)', letterSpacing: '2px', marginBottom: '8px' }}>STEP {s.step}</div>
                    <h3 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>{s.title}</h3>
                    <p style={{ color: 'var(--color-text-sub)', fontSize: '14px', lineHeight: 1.6 }}>{s.desc}</p>
                  </div>
                ))}
              </div>

              {/* Vibe section */}
              <div className="fade-up" style={{
                marginTop: '40px',
                background: 'var(--color-surface)',
                border: '1px solid #1C1C24',
                borderRadius: '16px',
                padding: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '32px',
                flexWrap: 'wrap'
              }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '2px', marginBottom: '8px' }}>PLUS</div>
                  <h3 style={{ fontSize: '2rem', marginBottom: '12px' }}>Your Vibe Score</h3>
                  <p style={{ color: 'var(--color-text-sub)', fontSize: '14px', lineHeight: 1.6 }}>
                    Separate from your NETR skill score. Rated on Communication, Unselfishness, Effort, Attitude, and Inclusion. Unlocks after 5+ rated games.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {[
                    { color: '#39FF14', label: 'Great Vibe', score: '4.5–5.0' },
                    { color: '#F5C542', label: 'Solid Vibe', score: '3.5–4.4' },
                    { color: '#FF9500', label: 'Mixed Vibe', score: '2.5–3.4' },
                    { color: '#FF453A', label: 'Bad Vibe', score: '1.0–2.4' },
                  ].map((v) => (
                    <div key={v.label} style={{
                      background: `${v.color}12`,
                      border: `1px solid ${v.color}33`,
                      borderRadius: '12px',
                      padding: '12px 16px',
                      textAlign: 'center',
                      minWidth: '110px'
                    }}>
                      <div className="vibe-dot" style={{ width: '10px', height: '10px', background: v.color, boxShadow: `0 0 8px ${v.color}`, margin: '0 auto 8px' }} />
                      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '14px', color: v.color }}>{v.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-sub)', fontFamily: 'var(--font-mono)' }}>{v.score}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* RATING SCALE */}
          <section id="rating-scale" className="py-20" style={{ background: 'var(--color-surface)' }}>
            <div className="container">
              <div className="text-center mb-12">
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-primary)', letterSpacing: '3px', marginBottom: '12px' }}>THE SCALE</div>
                <h2 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', marginBottom: '12px' }}>WHERE DO YOU LAND?</h2>
                <p style={{ color: 'var(--color-text-sub)', maxWidth: '480px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
                  Every score is earned through peer ratings. No self-assessment. No guessing. Just what the court says.
                </p>
              </div>

              <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {TIERS.map((tier, i) => (
                  <div key={tier.label} className="fade-up tier-row" style={{ '--tier-color': tier.color } as React.CSSProperties}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="tier-name">{tier.label}</span>
                      <span className="tier-range" style={{ color: tier.color, fontFamily: 'var(--font-mono)', fontSize: '14px' }}>{tier.range}</span>
                    </div>
                    <div className="tier-bar">
                      <div className="tier-bar-fill" style={{ '--fill': tier.fill, background: `linear-gradient(90deg, ${tier.color}66, ${tier.color})` } as React.CSSProperties} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="py-20">
            <div className="container text-center">
              <div style={{
                maxWidth: '600px',
                margin: '0 auto',
                background: 'var(--color-surface)',
                border: '1px solid rgba(57,255,20,0.2)',
                borderRadius: '24px',
                padding: '56px 40px',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                  background: 'linear-gradient(90deg, transparent, rgba(57,255,20,0.5), transparent)'
                }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-primary)', letterSpacing: '3px', marginBottom: '16px' }}>
                  FREE · BETA
                </div>
                <h2 style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', marginBottom: '16px' }}>
                  GET YOUR<br /><span className="text-primary">NETR SCORE</span>
                </h2>
                <p style={{ color: 'var(--color-text-sub)', marginBottom: '32px', fontSize: '15px', lineHeight: 1.6 }}>
                  Join the beta. Available now on TestFlight for iOS.
                  NYC courts already loaded. Your first game is waiting.
                </p>
                <a href={TESTFLIGHT_URL} className="btn-primary" style={{ fontSize: '1.3rem', padding: '1.1rem 3rem', display: 'inline-block' }}>
                  📲 Join Beta on TestFlight
                </a>
                <div style={{ marginTop: '20px', fontSize: '13px', color: 'var(--color-text-sub)' }}>
                  iOS only · Android coming soon · 100% free
                </div>
              </div>
            </div>
          </section>

        </main>

        {/* FOOTER */}
        <footer style={{ borderTop: '1px solid #1C1C24', padding: '32px 0' }}>
          <div className="container flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="logo" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>NETR</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-sub)', fontFamily: 'var(--font-mono)' }}>
                YOUR REP. BUILT ON THE COURT.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px', fontSize: '13px', color: 'var(--color-text-sub)' }}>
              <a href="/privacy" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--color-primary)'} onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--color-text-sub)'}>Privacy</a>
              <a href="/terms" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--color-primary)'} onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--color-text-sub)'}>Terms</a>
              <a href="https://instagram.com/netrapp" target="_blank" rel="noopener noreferrer" style={{ transition: 'color 0.2s' }} onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--color-primary)'} onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--color-text-sub)'}>Instagram</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
