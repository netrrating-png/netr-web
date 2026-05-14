import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function LeaguesPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const lbar = document.getElementById('lg-lbar') as HTMLElement
    const loader = document.getElementById('lg-loader') as HTMLElement
    let prog = 0
    const loadInt = setInterval(() => {
      prog += Math.random() * 18 + 4
      if (prog >= 100) { prog = 100; clearInterval(loadInt); setTimeout(() => loader.classList.add('out'), 300) }
      lbar.style.width = prog + '%'
    }, 60)

    const cur = document.getElementById('lg-cursor') as HTMLElement
    const trail = document.getElementById('lg-cursor-trail') as HTMLElement
    let mx = 0, my = 0, tx = 0, ty = 0
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; cur.style.left = mx + 'px'; cur.style.top = my + 'px' }
    document.addEventListener('mousemove', onMove)
    let rafT: number
    const animTrail = () => { tx += (mx - tx) * .14; ty += (my - ty) * .14; trail.style.left = tx + 'px'; trail.style.top = ty + 'px'; rafT = requestAnimationFrame(animTrail) }
    rafT = requestAnimationFrame(animTrail)

    const nav = document.getElementById('lg-nav') as HTMLElement
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })

    const progressBar = document.getElementById('lg-progress-bar') as HTMLElement
    const onScrollProgress = () => { const sc = document.documentElement.scrollTop, h = document.documentElement.scrollHeight - document.documentElement.clientHeight; progressBar.style.width = (sc / h * 100) + '%' }
    window.addEventListener('scroll', onScrollProgress, { passive: true })

    const spotlight = document.getElementById('lg-hero-spotlight') as HTMLElement
    const heroEl = document.getElementById('lg-hero') as HTMLElement
    const onHeroMove = (e: MouseEvent) => { const r = heroEl.getBoundingClientRect(); spotlight.style.background = `radial-gradient(700px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px,rgba(57,255,20,0.12),transparent 65%)`; spotlight.style.opacity = '1' }
    const onHeroLeave = () => { spotlight.style.opacity = '0' }
    heroEl.addEventListener('mousemove', onHeroMove)
    heroEl.addEventListener('mouseleave', onHeroLeave)

    document.querySelectorAll('.lg-tilt').forEach(el => {
      const card = el as HTMLElement
      card.addEventListener('mousemove', (ev: MouseEvent) => { const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5; card.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(10px)` })
      card.addEventListener('mouseleave', () => { card.style.transform = '' })
    })

    document.querySelectorAll('.lg-magnetic').forEach(btn => {
      const el = btn as HTMLElement
      el.addEventListener('mousemove', (ev: MouseEvent) => { const r = el.getBoundingClientRect(), x = (ev.clientX - r.left - r.width / 2) * .45, y = (ev.clientY - r.top - r.height / 2) * .45; el.style.transform = `translate(${x}px,${y}px)` })
      el.addEventListener('mouseleave', () => { el.style.transform = '' })
    })

    const ro = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target) } }) }, { threshold: 0.08 })
    document.querySelectorAll('.lg-reveal').forEach(el => ro.observe(el))

    const so = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); so.unobserve(e.target) } }) }, { threshold: 0.06 })
    document.querySelectorAll('.lg-stagger').forEach(el => so.observe(el))

    const canvas = document.getElementById('lg-canvas') as HTMLCanvasElement
    let rafC: number
    if (canvas) {
      const ctx = canvas.getContext('2d')!
      const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight }
      resize(); window.addEventListener('resize', resize)
      let phase = 0
      const loop = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        phase += 0.008
        const cols = Math.ceil(canvas.width / 60) + 1
        const rows = Math.ceil(canvas.height / 60) + 1
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const x = c * 60, y = r * 60
            const d = Math.sqrt(Math.pow(x - canvas.width / 2, 2) + Math.pow(y - canvas.height / 2, 2))
            const pulse = 0.04 + 0.03 * Math.sin(phase - d * 0.012)
            ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2)
            ctx.fillStyle = `rgba(57,255,20,${pulse})`; ctx.fill()
          }
        }
        rafC = requestAnimationFrame(loop)
      }
      loop()
    }

    return () => {
      clearInterval(loadInt)
      cancelAnimationFrame(rafT)
      if (typeof rafC !== 'undefined') cancelAnimationFrame(rafC)
      document.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('scroll', onScrollProgress)
      heroEl.removeEventListener('mousemove', onHeroMove)
      heroEl.removeEventListener('mouseleave', onHeroLeave)
    }
  }, [])

  const features = [
    {
      icon: '🗓️', tag: 'Smart Scheduling', title: 'Schedule Builder',
      desc: 'Auto-generate a full season schedule in seconds. Set your teams, games per team, and available days — NETR handles balanced matchups and no double-booking.',
      bullets: ['Round-robin or custom format', 'Division support', 'Playoff bracket generation', 'Reschedule anytime'],
      accent: '#39FF14',
    },
    {
      icon: '🌐', tag: 'League Website', title: 'Your League, Online',
      desc: 'Every league gets a public website with live standings, schedule, and player stats — branded to your league with a custom logo and accent color.',
      bullets: ['Public URL (netr.app/league/slug)', 'Live standings & schedule', 'Player stat leaderboards', 'Custom logo & colors'],
      accent: '#4A9EFF',
    },
    {
      icon: '📱', tag: 'NETR App', title: 'App-Connected',
      desc: 'Your league lives inside the NETR app. Players check schedules, standings, and stats from their phone — no extra setup needed.',
      bullets: ['Push notifications for players', 'Game day reminders', 'Real-time score updates', 'iOS & Android'],
      accent: '#F5C542',
    },
    {
      icon: '⭐', tag: 'NETR Rating', title: 'Every Player Rated',
      desc: 'Every player earns a verified NETR score — the same rating used across all pickup and league play. Real rep, built through league performance.',
      bullets: ['Peer-verified ratings', 'Carries across all leagues', 'Skill breakdown by category', 'Vibe score tracked too'],
      accent: '#FF7A00',
    },
    {
      icon: '📊', tag: 'Live Stats', title: 'Full Stat Tracking',
      desc: 'Track points, rebounds, assists, steals, blocks, and more. Leaderboards update the moment scores are entered. Configure exactly which stats matter.',
      bullets: ['Points, rebounds, assists + more', 'Per-game & season totals', 'Custom stat configuration', 'Live leaderboards'],
      accent: '#2ECC71',
    },
    {
      icon: '🏆', tag: 'Teams & Rosters', title: 'Team Management',
      desc: 'Create teams, assign colors, manage rosters, add players. Bulk-invite by email or share a join link — rosters fill themselves.',
      bullets: ['Unlimited teams & players', 'Custom team colors', 'Bulk player import', 'Division grouping'],
      accent: '#9B8BFF',
    },
  ]

  const steps = [
    { num: '01', icon: '✍️', title: 'Sign Up', desc: 'Create your NETR account in under a minute.' },
    { num: '02', icon: '🏀', title: 'Create Your League', desc: 'Name it, brand it, set your season. Takes 2 minutes.' },
    { num: '03', icon: '👥', title: 'Add Teams & Players', desc: 'Invite by email or share a join link.' },
    { num: '04', icon: '🗓️', title: 'Build the Schedule', desc: 'Hit Generate — NETR auto-builds a balanced season.' },
    { num: '05', icon: '🚀', title: 'Run Your League', desc: 'Enter scores. Standings, stats, and ratings update instantly.' },
  ]

  const tiers = [
    { range: '9.5–9.9', name: 'In The League', color: '#C40010', w: '100%', bg: 'linear-gradient(90deg,#C40010,#FF1A2E)', pct: 'Pros Only' },
    { range: '9.0–9.4', name: 'Certified', color: '#FF3B30', w: '93%', bg: 'linear-gradient(90deg,#FF3B30,#FF6B5F)', pct: 'Top 1%' },
    { range: '8.0–8.9', name: 'Elite', color: '#FF7A00', w: '85%', bg: 'linear-gradient(90deg,#FF7A00,#FFA040)', pct: 'Top 3%' },
    { range: '7.0–7.9', name: 'Built Different', color: '#FFC247', w: '74%', bg: 'linear-gradient(90deg,#FFC247,#FFD47A)', pct: 'Top 10%' },
    { range: '6.0–6.9', name: 'Hooper', color: '#39FF14', w: '63%', bg: 'linear-gradient(90deg,#39FF14,#70FF50)', pct: 'Top 20%' },
    { range: '5.0–5.9', name: 'Got Game', color: '#2ECC71', w: '52%', bg: 'linear-gradient(90deg,#2ECC71,#52E090)', pct: 'Top 35%' },
    { range: '4.0–4.9', name: 'Prospect', color: '#2DA8FF', w: '42%', bg: 'linear-gradient(90deg,#2DA8FF,#60C0FF)', pct: 'Above Average' },
    { range: '3.0–3.9', name: 'On The Come Up', color: '#7B9FFF', w: '30%', bg: 'linear-gradient(90deg,#7B9FFF,#95C2FF)', pct: 'Average', avg: true, highlight: true },
    { range: '2.0–2.9', name: 'Fresh Laces', color: '#9B8BFF', w: '18%', bg: 'linear-gradient(90deg,#9B8BFF,#B8ABFF)', pct: 'Just Starting' },
  ]

  return (
    <>
      <Head>
        <title>NETR Leagues — League Management for Basketball Organizers</title>
        <meta name="description" content="Run your basketball league with NETR. Smart schedule builder, league website, live standings, full stat tracking, and a verified NETR rating for every player." />
        <meta name="keywords" content="basketball league management, league software, basketball schedule builder, league standings, basketball stats tracker, NETR leagues, NETR rating" />
        <meta property="og:title" content="NETR Leagues — League Management for Basketball Organizers" />
        <meta property="og:description" content="Smart schedule builder, league website, live standings, full stat tracking, and a NETR rating for every player." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NETR Leagues — League Management" />
        <meta name="twitter:description" content="Smart schedule builder, league website, live standings, and NETR ratings for every player." />
        <link rel="canonical" href="https://netr.app/leagues" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#040406;--surface:#08080D;--card:#0D0D14;--border:#1A1A28;--accent:#39FF14;--text:#EEEEF5;--sub:#8A8AA8;--muted:#222232;}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        @media(hover:hover){body{cursor:none}}
        #lg-cursor{position:fixed;width:20px;height:20px;border-radius:50%;background:var(--accent);pointer-events:none;z-index:9999;transform:translate(-50%,-50%);box-shadow:0 0 12px var(--accent),0 0 30px #39FF1466;transition:width .15s,height .15s,background .15s;mix-blend-mode:screen;}
        #lg-cursor-trail{position:fixed;width:40px;height:40px;border-radius:50%;border:1px solid #39FF1455;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);}
        body:has(a:hover) #lg-cursor,body:has(button:hover) #lg-cursor{width:36px;height:36px;background:#fff;}
        @media(hover:none){#lg-cursor,#lg-cursor-trail{display:none}}
        #lg-grain{position:fixed;inset:0;pointer-events:none;z-index:1000;opacity:.028;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px;}
        #lg-loader{position:fixed;inset:0;z-index:9000;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;transition:opacity .5s ease;}
        #lg-loader.out{opacity:0;pointer-events:none}
        .lg-loader-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:64px;color:var(--accent);text-shadow:0 0 40px #39FF14cc;animation:lg-glow 1.5s ease-in-out infinite;}
        .lg-loader-bar-wrap{width:200px;height:2px;background:var(--border);border-radius:99px;overflow:hidden}
        .lg-loader-bar{height:100%;background:var(--accent);width:0;border-radius:99px;box-shadow:0 0 8px var(--accent);transition:width .05s linear}
        #lg-progress-bar{position:fixed;top:0;left:0;height:2px;width:0%;background:linear-gradient(90deg,var(--accent),#00FF88);z-index:9999;pointer-events:none;box-shadow:0 0 10px var(--accent),0 0 20px #39FF1466;}
        #lg-nav{position:fixed;top:0;left:0;right:0;z-index:500;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;transition:background .3s,border-color .3s;border-bottom:1px solid transparent;}
        #lg-nav.scrolled{background:rgba(4,4,6,.92);backdrop-filter:blur(24px);border-bottom-color:var(--border);}
        .lg-nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:30px;color:var(--accent);text-shadow:0 0 16px #39FF1499;letter-spacing:.02em;text-decoration:none;position:relative;}
        .lg-nav-logo::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--accent);box-shadow:0 0 8px var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .3s ease;}
        .lg-nav-logo:hover::after{transform:scaleX(1)}
        .lg-nav-links{display:flex;align-items:center;gap:22px}
        .lg-nav-links a{font-size:11px;font-weight:600;color:var(--sub);letter-spacing:.08em;text-transform:uppercase;transition:color .2s;text-decoration:none;position:relative;}
        .lg-nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1px;background:var(--accent);transition:width .25s ease;}
        .lg-nav-links a:hover{color:var(--text)}.lg-nav-links a:hover::after{width:100%}
        .lg-nav-links a.active-link{color:var(--accent);}.lg-nav-links a.active-link::after{width:100%;}
        .lg-btn-cta{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;transition:box-shadow .25s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-cta:hover{box-shadow:0 0 28px #39FF1488,0 6px 24px #39FF1444;transform:translateY(-2px);}
        .lg-hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px;z-index:600;}
        .lg-hamburger span{display:block;width:22px;height:2px;background:var(--text);border-radius:99px;transition:transform .3s,opacity .3s;}
        .lg-hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg);}
        .lg-hamburger.open span:nth-child(2){opacity:0;}
        .lg-hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}
        .lg-mobile-menu{position:fixed;inset:0;z-index:490;background:rgba(4,4,6,.97);backdrop-filter:blur(24px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;opacity:0;pointer-events:none;transition:opacity .3s ease;}
        .lg-mobile-menu.open{opacity:1;pointer-events:auto;}
        .lg-mobile-menu a{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:34px;letter-spacing:.04em;text-transform:uppercase;color:var(--text);text-decoration:none;padding:8px 0;transition:color .2s;}
        .lg-mobile-menu a:hover{color:var(--accent)}
        .lg-mob-cta{margin-top:16px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.1em;text-transform:uppercase;padding:14px 40px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;}
        @media(max-width:640px){#lg-nav{padding:0 20px}.lg-nav-links{display:none}.lg-hamburger{display:flex}}
        #lg-hero{position:relative;min-height:92vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        #lg-canvas{position:absolute;inset:0;width:100%;height:100%;}
        .lg-hero-spotlight{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .6s ease;}
        .lg-dot-grid{position:absolute;inset:0;pointer-events:none;z-index:2;background-image:radial-gradient(rgba(57,255,20,.15) 1px,transparent 1px);background-size:32px 32px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 45%,black,transparent);mask-image:radial-gradient(ellipse 80% 80% at 50% 45%,black,transparent);}
        .lg-blob{position:absolute;border-radius:50%;filter:blur(110px);pointer-events:none;animation:lg-blobFloat 12s ease-in-out infinite;}
        @keyframes lg-blobFloat{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(28px,-36px) scale(1.06)}70%{transform:translate(-18px,22px) scale(.96)}}
        .lg-hero-content{position:relative;z-index:10;text-align:center;padding:100px 24px 60px;max-width:1000px;margin:0 auto;}
        .lg-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#39FF1410;border:1px solid #39FF1430;border-radius:99px;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:24px;animation:lg-fadeUp .6s ease .1s both;}
        .lg-live-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:lg-livePulse 1.4s ease-in-out infinite;display:inline-block;}
        @keyframes lg-livePulse{0%,100%{box-shadow:0 0 0 0 #39FF1488}50%{box-shadow:0 0 0 6px transparent}}
        .lg-hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(64px,11vw,130px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;animation:lg-fadeUp .7s ease .2s both;margin-bottom:10px;}
        .lg-hero-title .lg-line2{background:linear-gradient(90deg,var(--accent),#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 30px #39FF1466);}
        .lg-hero-sub{font-size:clamp(15px,2vw,19px);color:var(--text);line-height:1.65;max-width:560px;margin:0 auto 36px;animation:lg-fadeUp .7s ease .35s both;}
        .lg-hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;animation:lg-fadeUp .7s ease .5s both;margin-bottom:40px;}
        .lg-btn-primary{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:17px;letter-spacing:.08em;text-transform:uppercase;padding:16px 40px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;position:relative;overflow:hidden;transition:box-shadow .25s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-primary:hover{box-shadow:0 0 36px #39FF1488,0 8px 32px #39FF1444;transform:translateY(-2px)}
        .lg-btn-primary::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.18),transparent);opacity:0;transition:opacity .3s;}.lg-btn-primary:hover::before{opacity:1;}
        .lg-btn-ghost{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;letter-spacing:.08em;text-transform:uppercase;padding:16px 40px;border-radius:10px;cursor:pointer;background:transparent;color:var(--text);border:1px solid var(--border);transition:border-color .2s,background .2s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-ghost:hover{border-color:#39FF1466;background:#39FF1408;transform:translateY(-2px)}
        .lg-hero-trust{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;animation:lg-fadeUp .7s ease .65s both;}
        .lg-trust-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text);font-weight:500;}
        .lg-trust-check{width:18px;height:18px;border-radius:50%;background:#39FF1420;border:1px solid #39FF1440;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--accent);flex-shrink:0;}
        @keyframes lg-fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lg-glow{0%,100%{box-shadow:0 0 16px #39FF1466,0 0 40px #39FF1433}50%{box-shadow:0 0 28px #39FF14cc,0 0 64px #39FF1466,0 0 100px #39FF1422}}
        .lg-reveal{opacity:0;transform:translateY(28px);transition:opacity .65s ease,transform .65s ease}
        .lg-reveal.in{opacity:1;transform:translateY(0)}
        .lg-reveal-right{opacity:0;transform:translateX(28px);transition:opacity .65s ease,transform .65s ease}
        .lg-reveal-right.in{opacity:1;transform:translateX(0)}
        .lg-stagger>*{opacity:0;transform:translateY(18px);transition:opacity .5s ease,transform .5s ease;}
        .lg-stagger.in>*:nth-child(1){opacity:1;transform:none;transition-delay:.04s}
        .lg-stagger.in>*:nth-child(2){opacity:1;transform:none;transition-delay:.11s}
        .lg-stagger.in>*:nth-child(3){opacity:1;transform:none;transition-delay:.18s}
        .lg-stagger.in>*:nth-child(4){opacity:1;transform:none;transition-delay:.25s}
        .lg-stagger.in>*:nth-child(5){opacity:1;transform:none;transition-delay:.32s}
        .lg-stagger.in>*:nth-child(6){opacity:1;transform:none;transition-delay:.39s}
        .lg-section{padding:72px 48px;max-width:1160px;margin:0 auto}
        .lg-section-head{text-align:center;margin-bottom:48px}
        .lg-label-tag{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:10px;display:inline-flex;align-items:center;gap:8px;}
        .lg-label-tag::before{content:'';width:18px;height:1px;background:var(--accent);box-shadow:0 0 6px var(--accent);}
        .lg-section-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(40px,5.5vw,76px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;}
        .lg-section-sub{color:var(--text);font-size:16px;max-width:520px;margin:12px auto 0;line-height:1.6}
        .lg-divider{position:relative;height:2px;margin:0;overflow:visible;background:linear-gradient(90deg,transparent,var(--border),transparent);}
        .lg-divider::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;border:2px solid var(--border);background:var(--bg);}
        .lg-features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
        .lg-feat-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:28px 24px;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;transform-style:preserve-3d;}
        .lg-feat-card:hover{transform:translateY(-6px);box-shadow:0 20px 56px rgba(57,255,20,.1),0 0 0 1px #39FF1428;}
        .lg-feat-glow{position:absolute;top:-40px;right:-40px;width:140px;height:140px;border-radius:50%;filter:blur(55px);pointer-events:none;opacity:.22;}
        .lg-feat-tag{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;display:inline-block;}
        .lg-feat-icon{font-size:32px;margin-bottom:10px;}
        .lg-feat-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;text-transform:uppercase;margin-bottom:10px;}
        .lg-feat-desc{font-size:13px;color:var(--text);line-height:1.65;margin-bottom:14px;}
        .lg-feat-bullets{display:flex;flex-direction:column;gap:7px;}
        .lg-feat-bullet{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text);}
        .lg-feat-bullet-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;}
        @media(max-width:860px){.lg-features-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:540px){.lg-features-grid{grid-template-columns:1fr}}
        .lg-steps-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;}
        .lg-step-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px 18px;text-align:center;transition:transform .25s,border-color .25s,box-shadow .25s;}
        .lg-step-card:hover{transform:translateY(-6px);border-color:#39FF1444;box-shadow:0 16px 48px rgba(57,255,20,.1)}
        .lg-step-num{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:8px;}
        .lg-step-icon{font-size:26px;margin-bottom:10px;}
        .lg-step-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;text-transform:uppercase;margin-bottom:8px;}
        .lg-step-desc{font-size:12px;color:var(--text);line-height:1.6}
        @media(max-width:860px){.lg-steps-grid{grid-template-columns:repeat(2,1fr) }}
        @media(max-width:480px){.lg-steps-grid{grid-template-columns:1fr 1fr}}
        .lg-preview-wrap{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;}
        .lg-preview-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(34px,4.5vw,58px);text-transform:uppercase;line-height:1;margin-bottom:14px;}
        .lg-preview-desc{font-size:14px;color:var(--text);line-height:1.7;margin-bottom:24px;}
        .lg-preview-pills{display:flex;flex-wrap:wrap;gap:7px;}
        .lg-pill{padding:5px 12px;border-radius:99px;background:var(--card);border:1px solid var(--border);font-size:11px;font-weight:600;color:var(--text);letter-spacing:.04em;}
        .lg-preview-mock{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden;box-shadow:0 28px 72px rgba(0,0,0,.6);}
        .lg-mock-bar{background:#1A1A28;padding:9px 14px;display:flex;align-items:center;gap:7px;border-bottom:1px solid var(--border);}
        .lg-mock-dot{width:9px;height:9px;border-radius:50%;}
        .lg-mock-url{flex:1;background:#0F0F14;border:1px solid var(--border);border-radius:5px;padding:3px 9px;font-size:9px;color:var(--sub);margin:0 8px;font-family:monospace;}
        .lg-mock-body{padding:16px;}
        .lg-mock-league-name{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;text-transform:uppercase;color:var(--accent);margin-bottom:3px;}
        .lg-mock-season{font-size:10px;color:var(--sub);margin-bottom:12px;}
        .lg-mock-tabs{display:flex;gap:2px;margin-bottom:12px;background:#1A1A28;padding:3px;border-radius:7px;}
        .lg-mock-tab{padding:5px 10px;border-radius:5px;font-size:10px;font-weight:600;color:var(--sub);cursor:default;}
        .lg-mock-tab.active{background:var(--bg);color:var(--accent);}
        .lg-mock-table{width:100%;border-collapse:collapse;}
        .lg-mock-table th{font-size:8px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sub);text-align:left;padding:5px 0;border-bottom:1px solid var(--border);}
        .lg-mock-table td{font-size:11px;padding:7px 0;border-bottom:1px solid #1A1A2810;color:var(--text);}
        .lg-mock-table tr:last-child td{border-bottom:none}
        .lg-mock-dot-g{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;}
        @media(max-width:768px){.lg-preview-wrap{grid-template-columns:1fr}}
        .lg-rating-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start;}
        .lg-player-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px;display:flex;align-items:flex-start;gap:14px;transition:transform .2s,border-color .25s,box-shadow .25s;margin-bottom:10px;}
        .lg-player-card:last-child{margin-bottom:0}
        .lg-player-card:hover{transform:translateX(5px);border-color:#39FF1444;box-shadow:0 10px 36px rgba(57,255,20,.09);}
        .lg-player-ring{width:50px;height:50px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
        .lg-player-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
        .lg-player-score{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:16px;line-height:1;position:relative;z-index:1;}
        .lg-player-lbl{font-size:6px;font-weight:700;letter-spacing:.1em;opacity:.8;position:relative;z-index:1}
        .lg-player-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;margin-bottom:2px}
        .lg-player-meta{font-size:11px;color:var(--sub);margin-bottom:4px;}
        .lg-player-tier{display:inline-block;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:.04em;}
        .lg-cat-bar{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--sub);}
        .lg-cat-track{flex:1;height:3px;background:var(--muted);border-radius:99px;overflow:hidden;min-width:50px;}
        .lg-cat-fill{height:100%;border-radius:99px;}
        @media(max-width:768px){.lg-rating-grid{grid-template-columns:1fr}}
        .lg-tier-list{max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:6px}
        .lg-tier-row{display:flex;align-items:center;gap:14px;padding:12px 18px;border-radius:12px;background:var(--card);border:1px solid var(--border);transition:transform .2s;position:relative;overflow:hidden;}
        .lg-tier-row:hover{transform:translateX(5px)}
        .lg-tier-range{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:17px;width:64px;flex-shrink:0;}
        .lg-tier-info{flex:1}
        .lg-tier-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:15px;line-height:1}
        .lg-tier-pct{font-size:11px;color:var(--text);margin-top:2px}
        .lg-tier-bar{height:4px;background:var(--muted);border-radius:99px;overflow:hidden;width:90px;flex-shrink:0}
        .lg-tier-fill{height:100%;border-radius:99px;width:0;transition:width 1.4s cubic-bezier(.16,1,.3,1);}
        .lg-reveal.in .lg-tier-fill{width:var(--w,50%)}
        .lg-avg-badge{display:inline-flex;align-items:center;gap:5px;margin-top:4px;padding:2px 8px;border-radius:99px;background:#7B9FFF22;border:1px solid #7B9FFF66;font-size:10px;font-weight:700;letter-spacing:.06em;color:#7B9FFF;text-transform:uppercase;}
        .lg-avg-dot{width:5px;height:5px;border-radius:50%;background:#7B9FFF;display:inline-block;animation:lg-auraPulse 2s ease-in-out infinite;}
        @keyframes lg-auraPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.7);opacity:.55}}
        .lg-tier-row-highlight{animation:lg-tierPulse 3.5s ease-in-out infinite;}
        @keyframes lg-tierPulse{0%,100%{box-shadow:none}50%{box-shadow:0 0 20px rgba(123,159,255,.16),inset 0 0 20px rgba(123,159,255,.03)}}
        #lg-cta{position:relative;overflow:hidden;background:radial-gradient(ellipse 80% 60% at 50% 50%,#39FF1412 0%,transparent 70%),var(--bg);padding:80px 48px;text-align:center;}
        .lg-cta-inner{position:relative;z-index:2;max-width:600px;margin:0 auto}
        .lg-cta-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(44px,7vw,88px);line-height:.95;text-transform:uppercase;margin-bottom:16px;}
        .lg-cta-title span{color:var(--accent);text-shadow:0 0 40px #39FF1466}
        .lg-cta-sub{font-size:16px;color:var(--text);margin-bottom:36px;line-height:1.6;}
        .lg-cta-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;}
        .lg-cta-note{font-size:13px;color:var(--sub)}
        .lg-cta-note a{color:var(--accent);text-decoration:none;}.lg-cta-note a:hover{text-decoration:underline;}
        .lg-tilt{transform-style:preserve-3d;will-change:transform;}
        .lg-tilt:not(:hover){transition:transform .5s cubic-bezier(.16,1,.3,1),border-color .25s,box-shadow .25s;}
        .lg-magnetic{will-change:transform;transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .25s !important;}
        footer.lg-footer{background:var(--surface);border-top:1px solid var(--border);padding:32px 48px;text-align:center;}
        .lg-footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;color:var(--accent);text-shadow:0 0 12px #39FF1477;margin-bottom:14px;}
        .lg-footer-links{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;margin-bottom:16px}
        .lg-footer-links a{font-size:12px;color:var(--sub);letter-spacing:.05em;transition:color .2s;text-decoration:none;}
        .lg-footer-links a:hover{color:var(--text)}
        .lg-footer-copy{font-size:11px;color:var(--muted)}
        @media(max-width:640px){
          .lg-section{padding:52px 20px}
          .lg-section-head{margin-bottom:36px}
          #lg-cta{padding:60px 20px}
          footer.lg-footer{padding:28px 20px}
          .lg-hero-content{padding:88px 20px 48px}
          .lg-hero-sub{margin-bottom:28px}
          .lg-hero-btns{margin-bottom:28px}
          .lg-hero-trust{gap:14px}
          .lg-trust-item{font-size:12px}
          .lg-feat-card{padding:22px 18px}
          .lg-step-card{padding:18px 14px}
          .lg-rating-grid{grid-template-columns:1fr}
          .lg-preview-wrap{grid-template-columns:1fr}
          .lg-tier-bar{display:none}
        }
      `}</style>

      <div id="lg-progress-bar" />
      <div id="lg-grain" />
      <div id="lg-cursor" />
      <div id="lg-cursor-trail" />

      <div id="lg-loader">
        <div className="lg-loader-logo">NETR</div>
        <div className="lg-loader-bar-wrap"><div className="lg-loader-bar" id="lg-lbar" /></div>
      </div>

      <nav id="lg-nav">
        <a href="/" className="lg-nav-logo">NETR</a>
        <div className="lg-nav-links">
          <a href="/#how">How It Works</a>
          <a href="/#scale">Rating Scale</a>
          <a href="/leagues" className="active-link">Leagues</a>
          <a href="/faq">FAQ</a>
          <a href="/league-portal/login" className="lg-btn-cta">Sign In</a>
        </div>
        <button className={`lg-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      <div className={`lg-mobile-menu${menuOpen ? ' open' : ''}`}>
        <a href="/#how" onClick={closeMenu}>How It Works</a>
        <a href="/#scale" onClick={closeMenu}>Rating Scale</a>
        <a href="/leagues" onClick={closeMenu}>Leagues</a>
        <a href="/faq" onClick={closeMenu}>FAQ</a>
        <a href="/league-portal/signup" onClick={closeMenu}>
          <button className="lg-mob-cta">Get Started</button>
        </a>
      </div>

      <section id="lg-hero">
        <canvas id="lg-canvas" />
        <div className="lg-dot-grid" />
        <div id="lg-hero-spotlight" className="lg-hero-spotlight" />
        <div className="lg-blob" style={{ width: 700, height: 700, background: 'rgba(57,255,20,0.11)', top: '-20%', right: '-14%', animationDuration: '14s' }} />
        <div className="lg-blob" style={{ width: 450, height: 450, background: 'rgba(0,204,34,0.06)', bottom: '-5%', left: '-10%', animationDuration: '10s', animationDelay: '-4s' }} />
        <div className="lg-hero-content">
          <div className="lg-eyebrow"><span className="lg-live-dot" />Now Onboarding Leagues</div>
          <h1 className="lg-hero-title">Run Your<br /><span className="lg-line2">League Right.</span></h1>
          <p className="lg-hero-sub">The complete league management platform for basketball organizers. Smart scheduling, live standings, full stat tracking, and a NETR rating for every player — all in one place.</p>
          <div className="lg-hero-btns">
            <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic">Get Started</a>
            <a href="#lg-features" className="lg-btn-ghost lg-magnetic">See All Features</a>
          </div>
          <div className="lg-hero-trust">
            {['Set up in under 5 minutes', 'No long-term commitment', 'Built for community ball'].map(t => (
              <div className="lg-trust-item" key={t}><div className="lg-trust-check">✓</div>{t}</div>
            ))}
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section id="lg-features" style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 500, height: 500, background: 'rgba(57,255,20,0.09)', top: '10%', right: '-12%', animationDuration: '16s', animationDelay: '-6s' }} />
        <div className="lg-section">
          <div className="lg-section-head">
            <span className="lg-label-tag lg-reveal">Everything Included</span>
            <h2 className="lg-section-title lg-reveal">Built for Organizers.</h2>
            <p className="lg-section-sub lg-reveal">Every tool you need to run a real league — from the first whistle to the championship.</p>
          </div>
          <div className="lg-features-grid lg-stagger">
            {features.map(f => (
              <article className="lg-feat-card lg-tilt" key={f.title}>
                <div className="lg-feat-glow" style={{ background: f.accent }} />
                <div className="lg-feat-icon">{f.icon}</div>
                <div className="lg-feat-tag" style={{ color: f.accent }}>{f.tag}</div>
                <h3 className="lg-feat-title">{f.title}</h3>
                <p className="lg-feat-desc">{f.desc}</p>
                <div className="lg-feat-bullets">
                  {f.bullets.map(b => (
                    <div className="lg-feat-bullet" key={b}>
                      <div className="lg-feat-bullet-dot" style={{ background: f.accent }} />{b}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section style={{ background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-section">
          <div className="lg-section-head">
            <span className="lg-label-tag lg-reveal">Get Started</span>
            <h2 className="lg-section-title lg-reveal">Live in 5 Steps.</h2>
            <p className="lg-section-sub lg-reveal">From sign-up to first game in minutes. Just log in and go.</p>
          </div>
          <div className="lg-steps-grid lg-stagger">
            {steps.map(s => (
              <div className="lg-step-card lg-tilt" key={s.num}>
                <div className="lg-step-num">Step {s.num}</div>
                <div className="lg-step-icon">{s.icon}</div>
                <h3 className="lg-step-title">{s.title}</h3>
                <p className="lg-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 500, height: 500, background: 'rgba(74,158,255,0.06)', top: '20%', right: '-10%', animationDuration: '15s', animationDelay: '-5s' }} />
        <div className="lg-section">
          <div className="lg-preview-wrap">
            <div>
              <span className="lg-label-tag lg-reveal">League Website</span>
              <h2 className="lg-preview-title lg-reveal">Your League.<br />Online. Instantly.</h2>
              <p className="lg-preview-desc lg-reveal">Every league gets a public website with a custom URL. Live standings, full schedule, and player leaderboards — updated the second you enter a score.</p>
              <div className="lg-preview-pills lg-reveal">
                {['Custom URL', 'Live standings', 'Player stats', 'Custom colors', 'Mobile-ready', 'No coding'].map(p => (
                  <span className="lg-pill" key={p}>{p}</span>
                ))}
              </div>
            </div>
            <div className="lg-preview-mock lg-reveal-right" style={{ transitionDelay: '.12s' }}>
              <div className="lg-mock-bar">
                <div className="lg-mock-dot" style={{ background: '#FF5F57' }} />
                <div className="lg-mock-dot" style={{ background: '#FEBC2E' }} />
                <div className="lg-mock-dot" style={{ background: '#28C840' }} />
                <div className="lg-mock-url">netr.app/league/bronx-summer-classic</div>
              </div>
              <div className="lg-mock-body">
                <div className="lg-mock-league-name">Bronx Summer Classic</div>
                <div className="lg-mock-season">2026 Season · 8 Teams · 4 Divisions</div>
                <div className="lg-mock-tabs">
                  {['Standings', 'Schedule', 'Stats', 'Teams'].map((t, i) => (
                    <div key={t} className={`lg-mock-tab${i === 0 ? ' active' : ''}`}>{t}</div>
                  ))}
                </div>
                <table className="lg-mock-table">
                  <thead><tr><th>#</th><th>Team</th><th>W</th><th>L</th><th>PTS</th></tr></thead>
                  <tbody>
                    {[
                      { rank: 1, name: 'Uptown Kings', color: '#39FF14', w: 8, l: 1, pts: 17 },
                      { rank: 2, name: 'BX Ballers', color: '#4A9EFF', w: 7, l: 2, pts: 15 },
                      { rank: 3, name: 'Harlem Elite', color: '#FF7A00', w: 6, l: 3, pts: 13 },
                      { rank: 4, name: 'South Bronx SC', color: '#9B8BFF', w: 5, l: 4, pts: 11 },
                    ].map(r => (
                      <tr key={r.rank}>
                        <td style={{ color: 'var(--sub)' }}>{r.rank}</td>
                        <td><span className="lg-mock-dot-g" style={{ background: r.color }} />{r.name}</td>
                        <td style={{ color: 'var(--accent)' }}>{r.w}</td>
                        <td style={{ color: 'var(--sub)' }}>{r.l}</td>
                        <td style={{ fontWeight: 700 }}>{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section style={{ background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 400, height: 400, background: 'rgba(255,122,0,0.07)', top: '10%', right: '-8%', animationDuration: '14s', animationDelay: '-2s' }} />
        <div className="lg-section">
          <div className="lg-rating-grid">
            <div>
              <span className="lg-label-tag lg-reveal">NETR Rating</span>
              <h2 className="lg-preview-title lg-reveal">Every Player<br />Gets Rated.</h2>
              <p className="lg-preview-desc lg-reveal">Every player in your league earns a verified NETR score — peer-verified, skill-based, and carried everywhere they play on NETR. Real rep, built through league performance.</p>
              <div className="lg-feat-bullets lg-reveal" style={{ gap: 10, marginBottom: 24 }}>
                {[
                  { label: 'Skill ratings across 7 categories', color: '#39FF14' },
                  { label: 'Vibe score tracks court conduct', color: '#F5C542' },
                  { label: 'Ratings carry across all leagues', color: '#4A9EFF' },
                  { label: 'Builds a verified basketball reputation', color: '#FF7A00' },
                ].map(b => (
                  <div className="lg-feat-bullet" key={b.label} style={{ fontSize: 13 }}>
                    <div className="lg-feat-bullet-dot" style={{ background: b.color, width: 7, height: 7 }} />{b.label}
                  </div>
                ))}
              </div>
              <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic lg-reveal">Get Started</a>
            </div>
            <div className="lg-reveal-right" style={{ transitionDelay: '.1s' }}>
              {[
                { name: 'Marcus J.', meta: 'PG · Bronx', score: 7.4, color: '#FF7A00', tier: 'Built Different', tierBg: '#FF7A0020', bars: [82, 74, 91, 68, 55, 88, 79] },
                { name: 'Deja W.', meta: 'SF · Harlem', score: 6.1, color: '#39FF14', tier: 'Hooper', tierBg: '#39FF1420', bars: [78, 82, 65, 70, 74, 80, 72] },
                { name: 'Chris B.', meta: 'C · Brooklyn', score: 5.3, color: '#2ECC71', tier: 'Got Game', tierBg: '#2ECC7120', bars: [55, 88, 48, 60, 91, 65, 82] },
              ].map(p => (
                <div className="lg-player-card lg-tilt" key={p.name}>
                  <div className="lg-player-ring">
                    <svg viewBox="0 0 50 50">
                      <circle cx="25" cy="25" r="21" fill="none" stroke="#1A1A28" strokeWidth="3" />
                      <circle cx="25" cy="25" r="21" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round"
                        strokeDasharray="132"
                        strokeDashoffset={String(132 - (132 * p.score / 10))}
                        style={{ filter: `drop-shadow(0 0 4px ${p.color})` }}
                      />
                    </svg>
                    <div className="lg-player-score" style={{ color: p.color }}>{p.score}</div>
                    <div className="lg-player-lbl" style={{ color: p.color }}>NETR</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="lg-player-name">{p.name}</div>
                    <div className="lg-player-meta">{p.meta}</div>
                    <div className="lg-player-tier" style={{ background: p.tierBg, color: p.color, border: `1px solid ${p.color}40` }}>{p.tier}</div>
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {['SHT', 'DEF', 'HND', 'PLY', 'REB', 'IQ', 'FIN'].map((cat, ci) => (
                        <div className="lg-cat-bar" key={cat}>
                          <span style={{ width: 24, flexShrink: 0 }}>{cat}</span>
                          <div className="lg-cat-track">
                            <div className="lg-cat-fill" style={{ width: `${p.bars[ci]}%`, background: p.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 400, height: 400, background: 'rgba(57,255,20,0.07)', top: '5%', left: '-8%', animationDuration: '13s', animationDelay: '-5s' }} />
        <div className="lg-section">
          <div className="lg-section-head">
            <span className="lg-label-tag lg-reveal">The Scale</span>
            <h2 className="lg-section-title lg-reveal">Know Where You Stand.</h2>
            <p className="lg-section-sub lg-reveal">9 tiers. Scale runs 2.0–9.9. Every point earned through peer ratings — never self-rated. Your league players land on this same scale.</p>
          </div>
          <div className="lg-tier-list">
            {tiers.map((t, i) => (
              <div className={`lg-tier-row lg-reveal${t.highlight ? ' lg-tier-row-highlight' : ''}`} key={t.name} style={{ transitionDelay: `${i * .04}s` }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: t.color, borderRadius: '99px 0 0 99px' }} />
                <div className="lg-tier-range" style={{ color: t.color }}>{t.range}</div>
                <div className="lg-tier-info">
                  <div className="lg-tier-name" style={{ color: t.color }}>{t.name}</div>
                  <div className="lg-tier-pct">{t.pct}</div>
                  {t.avg && <div className="lg-avg-badge"><span className="lg-avg-dot" />Most Players Land Here</div>}
                </div>
                <div className="lg-tier-bar">
                  <div className="lg-tier-fill" style={{ '--w': t.w, background: t.bg } as React.CSSProperties} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      <section id="lg-cta">
        <div className="lg-blob" style={{ width: 600, height: 600, background: 'rgba(57,255,20,0.1)', top: '-10%', left: '50%', transform: 'translateX(-50%)', animationDuration: '12s' }} />
        <div className="lg-cta-inner">
          <h2 className="lg-cta-title lg-reveal">Ready to<br /><span>Run Your League?</span></h2>
          <p className="lg-cta-sub lg-reveal" style={{ transitionDelay: '.1s' }}>No long-term contracts. No setup decks. Just a better way to run basketball.</p>
          <div className="lg-cta-btns lg-reveal" style={{ transitionDelay: '.2s' }}>
            <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic" style={{ fontSize: 17, padding: '16px 44px' }}>Create Your League</a>
            <a href="/league-portal/login" className="lg-btn-ghost lg-magnetic" style={{ fontSize: 17, padding: '16px 44px' }}>Sign In</a>
          </div>
          <p className="lg-cta-note lg-reveal" style={{ transitionDelay: '.3s' }}>
            Already have an account? <a href="/league-portal/login">Sign in here</a> · <a href="/faq">FAQ</a>
          </p>
        </div>
      </section>

      <footer className="lg-footer">
        <div className="lg-footer-logo">NETR</div>
        <div className="lg-footer-links">
          <a href="/">Home</a>
          <a href="/#how">How It Works</a>
          <a href="/leagues">Leagues</a>
          <a href="/faq">FAQ</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/league-portal/signup">Sign Up</a>
        </div>
        <p className="lg-footer-copy">© 2026 NETR. Built for organizers. Built for the culture.</p>
      </footer>
    </>
  )
}
