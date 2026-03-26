import Head from 'next/head'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'

const APP_URL = 'https://testflight.apple.com/join/REPLACE_ME'

export default function PlayerRate() {
  const router = useRouter()

  const handle   = (router.query.user    as string) || 'marcus_t'
  const name     = (router.query.name    as string) || 'Marcus T.'
  const score    = parseFloat((router.query.score   as string) || '6.8')
  const pos      = (router.query.pos     as string) || 'PG'
  const reviews  = parseInt((router.query.reviews  as string) || '34')
  const games    = parseInt((router.query.games    as string) || '18')
  const avatar   = (router.query.avatar  as string) || 'MT'

  const cats = {
    shooting:    parseFloat((router.query.c_shooting    as string) || '7.2'),
    defense:     parseFloat((router.query.c_defense     as string) || '6.1'),
    handles:     parseFloat((router.query.c_handles     as string) || '7.8'),
    playmaking:  parseFloat((router.query.c_playmaking  as string) || '8.0'),
    finishing:   parseFloat((router.query.c_finishing   as string) || '6.5'),
    rebounding:  parseFloat((router.query.c_rebounding  as string) || '5.4'),
    iq:          parseFloat((router.query.c_iq          as string) || '7.5'),
  }

  const [displayedScore, setDisplayedScore] = useState(0)
  const [barsAnimated, setBarsAnimated] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = `Rate ${name} on NETR` }, [name])

  useEffect(() => {
    let startTs: number | null = null
    let rafId: number
    const timeoutId = setTimeout(() => {
      const countUp = (ts: number) => {
        if (!startTs) startTs = ts
        const pct = Math.min((ts - startTs) / 1600, 1)
        const eased = 1 - Math.pow(1 - pct, 3)
        setDisplayedScore(eased * score)
        if (pct < 1) rafId = requestAnimationFrame(countUp)
      }
      rafId = requestAnimationFrame(countUp)
    }, 650)
    return () => { clearTimeout(timeoutId); cancelAnimationFrame(rafId) }
  }, [score])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { setBarsAnimated(true); observer.disconnect() } })
    }, { threshold: 0.3 })
    if (cardRef.current) observer.observe(cardRef.current)
    return () => observer.disconnect()
  }, [])

  const tier = (s: number) => {
    if (s >= 9.5) return 'In The League'
    if (s >= 9.0) return 'Certified'
    if (s >= 8.0) return 'Elite'
    if (s >= 7.0) return 'Built Different'
    if (s >= 6.0) return 'Hooper'
    if (s >= 5.0) return 'Got Game'
    if (s >= 4.0) return 'Prospect'
    if (s >= 3.0) return 'On The Come Up'
    return 'Fresh Laces'
  }

  const scoreColor = (s: number) => {
    if (s >= 9.5) return '#C40010'
    if (s >= 9.0) return '#FF3B30'
    if (s >= 8.0) return '#FF7A00'
    if (s >= 7.0) return '#FFC247'
    if (s >= 6.0) return '#39FF14'
    if (s >= 5.0) return '#2ECC71'
    if (s >= 4.0) return '#2DA8FF'
    if (s >= 3.0) return '#7B9FFF'
    return '#9B8BFF'
  }

  const c = scoreColor(score)
  const playerTier = tier(score)

  const catLabels: Record<string, string> = {
    shooting: 'Shooting', defense: 'Defense', handles: 'Handles',
    playmaking: 'Playmaking', finishing: 'Finishing', rebounding: 'Boards', iq: 'IQ'
  }

  const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1])

  const handleRipple = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 2
    const r = document.createElement('span')
    Object.assign(r.style, {
      position: 'absolute', borderRadius: '50%', pointerEvents: 'none',
      width: size + 'px', height: size + 'px',
      left: (e.clientX - rect.left - size / 2) + 'px',
      top: (e.clientY - rect.top - size / 2) + 'px',
      background: 'rgba(255,255,255,0.18)',
      transform: 'scale(0)', transition: 'transform 0.55s ease, opacity 0.55s ease', opacity: '1',
    })
    btn.appendChild(r)
    requestAnimationFrame(() => { r.style.transform = 'scale(1)'; r.style.opacity = '0' })
    setTimeout(() => r.remove(), 600)
  }

  return (
    <>
      <Head>
        <title>Rate {name} on NETR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="player-rate-page">
        <div className="bg-orbs">
          <div className="orb orb-1" /><div className="orb orb-2" /><div className="orb orb-3" />
        </div>
        <div className="scanline-wrap"><div className="scanline" /></div>
        <div className="float-ball">🏀</div>

        <div className="page">
          {/* Topbar */}
          <div className="topbar">
            <div className="logo">
              <div className="logo-icon"><span>N</span></div>
              <div className="logo-name">NETR</div>
            </div>
            <div className="live-badge"><div className="live-dot" />Live</div>
          </div>

          {/* Eyebrow */}
          <div className="hero">
            <div className="hero-eyebrow">
              <span>@{handle}</span> wants you to rate him 👇
            </div>
          </div>

          {/* Player Card */}
          <div className="player-card" ref={cardRef}>
            <div className="player-top">
              <div className="avatar-wrap">
                <div className="avatar" style={{ borderColor: c, color: c }}>{avatar}</div>
                <div className="avatar-ring" />
              </div>
              <div className="player-info">
                <div className="player-name">{name}</div>
                <div className="player-handle">@{handle} · New York</div>
                <div className="player-tags">
                  <span className="tag tag-pos">{pos}</span>
                  <span className="tag tag-tier">{playerTier}</span>
                </div>
              </div>
            </div>

            <div className="score-block">
              <div className="score-left">
                <div className="score-label">NETR Score</div>
                <div className="score-value" style={{ color: c, textShadow: `0 0 20px ${c}66` }}>
                  {displayedScore.toFixed(1)}
                </div>
                <div className="score-tier" style={{ color: c }}>{playerTier}</div>
              </div>
              <div className="score-stats">
                <div className="stat-pill"><div className="stat-num">{reviews}</div><div className="stat-lbl">Reviews</div></div>
                <div className="stat-pill"><div className="stat-num">{games}</div><div className="stat-lbl">Games</div></div>
              </div>
            </div>

            <div className="cats-label">Category Breakdown</div>
            <div>
              {sortedCats.map(([key, val]) => (
                <div className="cat-row" key={key}>
                  <div className="cat-name">{catLabels[key]}</div>
                  <div className="cat-bar">
                    <div className="cat-bar-fill" style={{ width: barsAnimated ? `${(val / 9.9) * 100}%` : '0%' }} />
                  </div>
                  <div className="cat-score">{val.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate CTA */}
          <div className="rate-cta">
            <div className="rate-heading">Run with him?<br /><span>Rate his game.</span></div>
            <p className="rate-sub">
              Create a free NETR account to leave your honest rating — then get your own verified score from everyone you run with.
            </p>
            <a href={APP_URL} className="dl-btn" onClick={handleRipple}>
              <span className="btn-icon">📲</span> Create Account &amp; Rate Him
            </a>
            <div className="dl-sub">Free · Takes 2 minutes<br /><strong>You'll get your own verified rating too</strong></div>
          </div>

          {/* Account Notice */}
          <div className="account-notice">
            <div className="notice-icon">🔒</div>
            <div className="notice-text">
              <strong>Account required to rate.</strong> Ratings on NETR are tied to real identities — that's what makes them mean something. No burner accounts, no fake scores.
            </div>
          </div>

          {/* How it Works */}
          <div className="how-section">
            <div className="section-label">How NETR Works</div>
            <div className="steps">
              {[
                { icon: '📲', title: 'Download & Create Your Account', desc: 'Free to join. Set up your profile, pick your position, and get your starting estimate.' },
                { icon: '⭐', title: 'Rate the People You Run With', desc: 'Find today\'s game in the app and leave your honest rating across 7 skill categories. 60 seconds.' },
                { icon: '📈', title: 'Build Your Own Verified Rep', desc: 'Every game you play, you get rated too. Your NETR score grows with your game — permanently.' },
              ].map(s => (
                <div className="step" key={s.title}>
                  <div className="step-icon">{s.icon}</div>
                  <div>
                    <div className="step-title">{s.title}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trust Strip */}
          <div className="trust-strip">
            <div className="trust-item"><div className="trust-num">584</div><div className="trust-lbl">NYC Courts</div></div>
            <div className="trust-div" />
            <div className="trust-item"><div className="trust-num">7</div><div className="trust-lbl">Skill Categories</div></div>
            <div className="trust-div" />
            <div className="trust-item"><div className="trust-num">0%</div><div className="trust-lbl">Self-Rating</div></div>
          </div>

          {/* Active Courts */}
          <div className="courts-section">
            <div className="section-label">Active Courts Right Now</div>
            <div className="courts-row">
              {[
                { name: 'Rucker Park', city: 'Harlem, NY', color: '#39FF14' },
                { name: 'West 4th Street', city: 'Manhattan, NY', color: '#39FF14' },
                { name: 'Dyckman Park', city: 'Inwood, NY', color: '#F5C542' },
                { name: 'Elmhurst Park', city: 'Queens, NY', color: '#39FF14' },
              ].map(court => (
                <div className="court-chip" key={court.name}>
                  <div className="court-dot" style={{ background: court.color, boxShadow: `0 0 6px ${court.color}` }} />
                  <div><div className="court-name">{court.name}</div><div className="court-city">{court.city}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="bottom-cta">
            <div className="bottom-cta-label">Don't just rate him — <span>get your own score</span></div>
            <a href={APP_URL} className="dl-btn" onClick={handleRipple}>
              <span className="btn-icon">🏀</span> Get Your Own NETR Rating
            </a>
          </div>

          {/* Footer */}
          <div className="footer">
            <div className="footer-logo">NETR</div>
            <div className="footer-tagline">Your rep. Built on the court.</div>
            <div className="footer-links">
              <a href="/privacy">Privacy</a>
              <span style={{ color: 'var(--muted)' }}>·</span>
              <a href="/terms">Terms</a>
              <span style={{ color: 'var(--muted)' }}>·</span>
              <a href="https://instagram.com/netrapp" target="_blank" rel="noopener noreferrer">Instagram</a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
