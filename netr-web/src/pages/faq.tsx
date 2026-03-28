import Head from 'next/head'
import { useEffect, useState } from 'react'

const TESTFLIGHT_URL = process.env.NEXT_PUBLIC_TESTFLIGHT_URL || 'https://testflight.apple.com/join/REPLACE_ME'

const faqs: { section: string; items: { q: string; a: string }[] }[] = [
  {
    section: 'Getting Started',
    items: [
      {
        q: 'What is NETR?',
        a: 'NETR is a peer-to-peer basketball rating app. You get a numeric score — your NETR rating — based on how the players you actually run with rate your game. No algorithms based on stats. No self-reporting. Just real players giving real feedback after real runs.',
      },
      {
        q: 'How do I get my NETR score?',
        a: 'When you sign up, you complete a short self-assessment that gives you a starting score. From there, every player you run with can rate you after a game across 7 skill categories. The more you play, the more peer ratings build up and shape your real score.',
      },
      {
        q: 'Is NETR free?',
        a: 'Yes — NETR is free to download and use. We\'re currently in iOS beta for NYC.',
      },
      {
        q: 'Is NETR only in NYC right now?',
        a: 'We\'re NYC-first. Courts across all five boroughs are already loaded in the app. Expansion to other cities is coming — drop your city in the waitlist on the home page so we know where to go next.',
      },
    ],
  },
  {
    section: 'Ratings & Your Score',
    items: [
      {
        q: 'Can I inflate my own score or rate myself higher?',
        a: 'No. You never rate yourself in-game — you only rate others after a run. Your self-assessment gives you a starting point, but peer ratings from actual games are what build your real NETR score. The more you play, the less your self-assessment matters.',
      },
      {
        q: 'What are the 7 skill categories I get rated on?',
        a: 'Shooting, Finishing, Handles, Passing (Playmaking), Rebounding, Basketball IQ, and Defense. Every player who rates you scores you across these categories after a game.',
      },
      {
        q: 'How many peer reviews do I need before my score is verified?',
        a: 'You need 5+ peer reviews for your score to be considered verified. Until then, your profile reflects your self-assessment baseline.',
      },
      {
        q: 'What if someone rates me unfairly or tries to tank my score?',
        a: 'We have outlier detection built in. Extreme ratings that fall way outside your established range are automatically down-weighted. One bad actor can\'t sink your score.',
      },
      {
        q: 'Can my NETR score go down?',
        a: 'Yes. If peers consistently rate you lower than your current score, it will adjust over time. Your score moves in both directions — it reflects what players who\'ve actually run with you think.',
      },
      {
        q: 'What does my score actually mean? How do I read it?',
        a: 'The scale runs from 2.0 to 9.9. Most pickup players land in the 3.0–3.9 range (On The Come Up). Getting into the 6s means you\'re a legitimate Hooper. 7s are Built Different. 8s are Elite. 9.5+ is pros only. Check the Rating Scale on the home page for the full breakdown.',
      },
    ],
  },
  {
    section: 'Playing & Finding Games',
    items: [
      {
        q: 'How do I join a game?',
        a: 'Open NETR and see active games at courts near you. Join by scanning the host\'s QR code or entering the 6-digit join code. Up to 10 players per game session.',
      },
      {
        q: 'How do I host a game?',
        a: 'Tap "Start a Game" in the app, select a court, and share your QR code or join code with players. Once everyone\'s in, you can use Make Teams to auto-split into balanced squads before tip-off.',
      },
      {
        q: 'What is Make Teams?',
        a: 'Make Teams automatically balances players into fair 2v2 through 5v5 squads based on their NETR scores. No more arguing about who picks first.',
      },
    ],
  },
  {
    section: 'Vibe Score & Reputation',
    items: [
      {
        q: 'What is the Vibe Score?',
        a: 'Vibe is separate from your skill score. It measures how you show up — your energy, attitude, and whether you\'re someone players actually want to run with again. You can be a 4.0 player with a great vibe, or a 7.0 nobody wants on their team.',
      },
      {
        q: 'What is Court Rep?',
        a: 'Court Rep is your XP system. You earn it by showing up, rating other players, hosting games, and hitting milestones. It tracks your progression from Newcomer all the way to Legend.',
      },
    ],
  },
  {
    section: 'Crews',
    items: [
      {
        q: 'What is a Crew?',
        a: 'A crew is your squad on NETR. Create one, invite your guys, and your collective NETR scores stack on a crew leaderboard. There\'s also a built-in group chat to coordinate runs and stay connected.',
      },
      {
        q: 'How do I create or join a crew?',
        a: 'In the app, search for existing crews by name or create your own. Invite players directly by their username — no long invite codes.',
      },
    ],
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    const nav = document.getElementById('faq-nav') as HTMLElement
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <Head>
        <title>FAQ — NETR</title>
        <meta name="description" content="Answers to the most common questions about NETR — how ratings work, how to find games, crews, vibe scores, and more." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#040406;--surface:#08080D;--card:#0D0D14;--border:#1A1A28;--accent:#39FF14;--text:#EEEEF5;--sub:#5A5A78;--muted:#222232;}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        #faq-nav{position:fixed;top:0;left:0;right:0;z-index:500;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;transition:background .3s,border-color .3s;border-bottom:1px solid transparent;}
        #faq-nav.scrolled{background:rgba(4,4,6,.92);backdrop-filter:blur(24px);border-bottom-color:var(--border);}
        .nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:30px;color:var(--accent);text-shadow:0 0 16px #39FF1499;letter-spacing:.02em;text-decoration:none;}
        .nav-links{display:flex;align-items:center;gap:36px}
        .nav-links a{font-size:12px;font-weight:600;color:var(--sub);letter-spacing:.1em;text-transform:uppercase;transition:color .2s;text-decoration:none;}
        .nav-links a:hover{color:var(--text)}
        .btn-cta{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;transition:box-shadow .25s,transform .2s;}
        .btn-cta:hover{box-shadow:0 0 28px #39FF1488,0 6px 24px #39FF1444;transform:translateY(-2px);}
        @media(max-width:640px){#faq-nav{padding:0 20px}.nav-links a{display:none}}
        .faq-hero{padding:140px 48px 80px;text-align:center;max-width:800px;margin:0 auto;}
        .faq-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#39FF1410;border:1px solid #39FF1430;border-radius:99px;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:28px;}
        .faq-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(56px,9vw,100px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:20px;}
        .faq-title span{background:linear-gradient(90deg,var(--accent),#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 24px #39FF1466);}
        .faq-sub{font-size:17px;color:var(--sub);line-height:1.7;}
        .faq-body{max-width:800px;margin:0 auto;padding:0 48px 120px;}
        .faq-section-label{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:16px;margin-top:56px;display:block;}
        .faq-section-label:first-child{margin-top:0}
        .faq-item{border:1px solid var(--border);border-radius:14px;overflow:hidden;margin-bottom:10px;background:var(--card);transition:border-color .2s;}
        .faq-item.open{border-color:#39FF1433;}
        .faq-q{width:100%;background:none;border:none;cursor:pointer;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;text-align:left;}
        .faq-q-text{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;color:var(--text);line-height:1.2;}
        .faq-icon{width:28px;height:28px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .2s,border-color .2s;}
        .faq-item.open .faq-icon{background:#39FF1420;border-color:#39FF1466;}
        .faq-icon svg{transition:transform .25s;}
        .faq-item.open .faq-icon svg{transform:rotate(45deg);}
        .faq-a{max-height:0;overflow:hidden;transition:max-height .35s cubic-bezier(.16,1,.3,1),padding .25s;}
        .faq-item.open .faq-a{max-height:400px;padding-bottom:20px;}
        .faq-a-inner{padding:0 24px;font-size:14px;color:var(--sub);line-height:1.75;}
        footer{background:var(--surface);border-top:1px solid var(--border);padding:40px 48px;text-align:center;}
        .footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;color:var(--accent);text-shadow:0 0 12px #39FF1477;margin-bottom:16px;}
        .footer-links{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
        .footer-links a{font-size:12px;color:var(--sub);letter-spacing:.05em;transition:color .2s;text-decoration:none;}
        .footer-links a:hover{color:var(--text)}
        .footer-copy{font-size:11px;color:var(--muted)}
      `}</style>

      <nav id="faq-nav">
        <a href="/" className="nav-logo">NETR</a>
        <div className="nav-links">
          <a href="/#how">How It Works</a>
          <a href="/#scale">Rating Scale</a>
          <a href="/#crews">Crews</a>
          <a href="/faq">FAQ</a>
          <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer"><button className="btn-cta">Get the App</button></a>
        </div>
      </nav>

      <div className="faq-hero">
        <div className="faq-eyebrow">Got Questions</div>
        <h1 className="faq-title">We Got<br /><span>Answers.</span></h1>
        <p className="faq-sub">Everything you need to know about NETR, your score, and how the court works.</p>
      </div>

      <div className="faq-body">
        {faqs.map(section => (
          <div key={section.section}>
            <span className="faq-section-label">{section.section}</span>
            {section.items.map(item => {
              const id = item.q
              const isOpen = open === id
              return (
                <div className={`faq-item${isOpen ? ' open' : ''}`} key={id}>
                  <button className="faq-q" onClick={() => setOpen(isOpen ? null : id)}>
                    <span className="faq-q-text">{item.q}</span>
                    <span className="faq-icon">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M6 1v10M1 6h10" stroke="#39FF14" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    </span>
                  </button>
                  <div className="faq-a">
                    <p className="faq-a-inner">{item.a}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <footer>
        <div className="footer-logo">NETR</div>
        <div className="footer-links">
          <a href="/#how">How It Works</a>
          <a href="/#scale">Rating Scale</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="https://instagram.com/netrapp" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
        <p className="footer-copy">© 2026 NETR. NYC-first. Built for ballers.</p>
      </footer>
    </>
  )
}
