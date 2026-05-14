import Head from 'next/head'
import { useEffect, useState } from 'react'

export default function LeaguesPage() {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    // LOADER
    const lbar = document.getElementById('lg-lbar') as HTMLElement
    const loader = document.getElementById('lg-loader') as HTMLElement
    let prog = 0
    const loadInt = setInterval(() => {
      prog += Math.random() * 18 + 4
      if (prog >= 100) { prog = 100; clearInterval(loadInt); setTimeout(() => loader.classList.add('out'), 300) }
      lbar.style.width = prog + '%'
    }, 60)

    // CURSOR
    const cur = document.getElementById('lg-cursor') as HTMLElement
    const trail = document.getElementById('lg-cursor-trail') as HTMLElement
    let mx = 0, my = 0, tx = 0, ty = 0
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; cur.style.left = mx + 'px'; cur.style.top = my + 'px' }
    document.addEventListener('mousemove', onMove)
    let rafT: number
    const animTrail = () => { tx += (mx - tx) * .14; ty += (my - ty) * .14; trail.style.left = tx + 'px'; trail.style.top = ty + 'px'; rafT = requestAnimationFrame(animTrail) }
    rafT = requestAnimationFrame(animTrail)

    // NAVBAR scroll
    const nav = document.getElementById('lg-nav') as HTMLElement
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })

    // SCROLL PROGRESS BAR
    const progressBar = document.getElementById('lg-progress-bar') as HTMLElement
    const onScrollProgress = () => { const sc = document.documentElement.scrollTop, h = document.documentElement.scrollHeight - document.documentElement.clientHeight; progressBar.style.width = (sc / h * 100) + '%' }
    window.addEventListener('scroll', onScrollProgress, { passive: true })

    // HERO SPOTLIGHT
    const spotlight = document.getElementById('lg-hero-spotlight') as HTMLElement
    const heroEl = document.getElementById('lg-hero') as HTMLElement
    const onHeroMove = (e: MouseEvent) => { const r = heroEl.getBoundingClientRect(); spotlight.style.background = `radial-gradient(700px circle at ${e.clientX - r.left}px ${e.clientY - r.top}px,rgba(57,255,20,0.12),transparent 65%)`; spotlight.style.opacity = '1' }
    const onHeroLeave = () => { spotlight.style.opacity = '0' }
    heroEl.addEventListener('mousemove', onHeroMove)
    heroEl.addEventListener('mouseleave', onHeroLeave)

    // 3D CARD TILT
    document.querySelectorAll('.lg-tilt').forEach(el => {
      const card = el as HTMLElement
      card.addEventListener('mousemove', (ev: MouseEvent) => { const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width - .5, y = (ev.clientY - r.top) / r.height - .5; card.style.transform = `perspective(800px) rotateY(${x * 14}deg) rotateX(${-y * 14}deg) translateZ(10px)` })
      card.addEventListener('mouseleave', () => { card.style.transform = '' })
    })

    // MAGNETIC BUTTONS
    document.querySelectorAll('.lg-magnetic').forEach(btn => {
      const el = btn as HTMLElement
      el.addEventListener('mousemove', (ev: MouseEvent) => { const r = el.getBoundingClientRect(), x = (ev.clientX - r.left - r.width / 2) * .45, y = (ev.clientY - r.top - r.height / 2) * .45; el.style.transform = `translate(${x}px,${y}px)` })
      el.addEventListener('mouseleave', () => { el.style.transform = '' })
    })

    // SCROLL REVEAL
    const ro = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target) } }) }, { threshold: 0.1 })
    document.querySelectorAll('.lg-reveal').forEach(el => ro.observe(el))

    // STAGGER REVEAL
    const so = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); so.unobserve(e.target) } }) }, { threshold: 0.1 })
    document.querySelectorAll('.lg-stagger').forEach(el => so.observe(el))

    // COUNT UP
    const co = new IntersectionObserver(entries => { entries.forEach(e => { if (e.isIntersecting) { const el = e.target as HTMLElement, t = parseInt(el.dataset.t || '0'), dur = 2000, s = performance.now(); const step = (now: number) => { const p = Math.min((now - s) / dur, 1), ea = 1 - Math.pow(1 - p, 4); el.textContent = Math.round(ea * t).toLocaleString(); if (p < 1) requestAnimationFrame(step) }; requestAnimationFrame(step); co.unobserve(e.target) } }) }, { threshold: .5 })
    document.querySelectorAll('.lg-ctr[data-t]').forEach(el => co.observe(el))

    // CANVAS GRID BACKGROUND
    const canvas = document.getElementById('lg-canvas') as HTMLCanvasElement
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
        requestAnimationFrame(loop)
      }
      loop()
      return () => { clearInterval(loadInt); cancelAnimationFrame(rafT); document.removeEventListener('mousemove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('scroll', onScrollProgress); heroEl.removeEventListener('mousemove', onHeroMove); heroEl.removeEventListener('mouseleave', onHeroLeave) }
    }

    return () => { clearInterval(loadInt); cancelAnimationFrame(rafT); document.removeEventListener('mousemove', onMove); window.removeEventListener('scroll', onScroll); window.removeEventListener('scroll', onScrollProgress); heroEl.removeEventListener('mousemove', onHeroMove); heroEl.removeEventListener('mouseleave', onHeroLeave) }
  }, [])

  const features = [
    {
      icon: '🗓️',
      tag: 'Smart Scheduling',
      title: 'Schedule Builder',
      desc: 'Auto-generate a full season schedule in seconds. Set your number of teams, games per team, available days, and let NETR handle the rest — balanced matchups, no double-booking.',
      bullets: ['Round-robin or custom format', 'Division support', 'Playoff bracket generation', 'Reschedule anytime'],
      accent: '#39FF14',
    },
    {
      icon: '🌐',
      tag: 'Free League Website',
      title: 'Your League, Online',
      desc: 'Every league gets a free public website with live standings, schedule, and player stats — branded to your league with a custom logo and accent color.',
      bullets: ['Public URL (netr.app/league/your-name)', 'Live standings & schedule', 'Player stat leaderboards', 'Custom logo & colors'],
      accent: '#4A9EFF',
    },
    {
      icon: '📱',
      tag: 'NETR App',
      title: 'App-Connected',
      desc: "Your league lives inside the NETR app. Players can view schedules, check standings, and track their stats right from their phone — no extra setup needed.",
      bullets: ['Players get push notifications', 'Game day reminders', 'Score updates in real-time', 'iOS & Android ready'],
      accent: '#F5C542',
    },
    {
      icon: '⭐',
      tag: 'NETR Rating',
      title: 'Every Player Rated',
      desc: "Every player in your league gets a NETR rating — the same verified score used across all pickup and league play. Build real rep through league performance.",
      bullets: ['Peer-verified ratings', 'Carries across all leagues', 'Skill breakdown by category', 'Vibe score tracked too'],
      accent: '#FF7A00',
    },
    {
      icon: '📊',
      tag: 'Live Stats',
      title: 'Full Stat Tracking',
      desc: 'Track points, rebounds, assists, steals, blocks, and more. Leaderboards update live as scores come in. Configure exactly which stats matter for your league.',
      bullets: ['Points, rebounds, assists + more', 'Per-game & season totals', 'Custom stat configurations', 'Exportable leaderboards'],
      accent: '#2ECC71',
    },
    {
      icon: '🏆',
      tag: 'Teams & Rosters',
      title: 'Full Team Management',
      desc: 'Create teams, assign colors, manage rosters, and add players in seconds. Bulk-invite players by email or let them join with a link.',
      bullets: ['Unlimited teams & players', 'Custom team colors', 'Bulk player import', 'Division grouping'],
      accent: '#9B8BFF',
    },
  ]

  const steps = [
    { num: '01', icon: '✍️', title: 'Sign Up Free', desc: 'Create your NETR account in under a minute. No credit card, no catch.' },
    { num: '02', icon: '🏀', title: 'Create Your League', desc: 'Name it, brand it, set your sport and season. Takes about 2 minutes.' },
    { num: '03', icon: '👥', title: 'Add Teams & Players', desc: 'Invite teams and players by email or share a join link. Rosters fill themselves.' },
    { num: '04', icon: '🗓️', title: 'Build the Schedule', desc: 'Hit Generate — NETR auto-builds a full balanced schedule for your season.' },
    { num: '05', icon: '🚀', title: 'Run Your League', desc: 'Enter scores after games. Standings, stats, and ratings update automatically.' },
  ]

  return (
    <>
      <Head>
        <title>NETR Leagues — Free League Management for Organizers</title>
        <meta name="description" content="Run your basketball league with NETR. Smart schedule builder, free league website, live standings, full stat tracking, and NETR ratings for every player. Free for league owners." />
        <meta name="keywords" content="basketball league management, free league software, basketball schedule builder, league standings, basketball stats tracker, NETR leagues" />
        <meta property="og:title" content="NETR Leagues — Free League Management for Organizers" />
        <meta property="og:description" content="Run your basketball league with NETR. Smart schedule builder, free league website, live standings, full stat tracking, and NETR ratings for every player. Free for league owners." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NETR Leagues — Free League Management" />
        <meta name="twitter:description" content="Smart schedule builder, free league website, live standings, and NETR ratings. Free for league owners." />
        <link rel="canonical" href="https://netr.app/leagues" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#040406;--surface:#08080D;--card:#0D0D14;--border:#1A1A28;--accent:#39FF14;--gold:#F5C542;--blue:#4A9EFF;--red:#FF453A;--orange:#FF7A00;--purple:#9B8BFF;--text:#EEEEF5;--sub:#5A5A78;--muted:#222232;}
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
        .lg-nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;width:0;height:1px;background:var(--accent);box-shadow:0 0 4px var(--accent);transition:width .25s ease;}
        .lg-nav-links a:hover{color:var(--text)}
        .lg-nav-links a:hover::after{width:100%}
        .lg-nav-links a.active-link{color:var(--accent);}
        .lg-nav-links a.active-link::after{width:100%;}
        .lg-btn-cta{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;transition:box-shadow .25s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-cta:hover{box-shadow:0 0 28px #39FF1488,0 6px 24px #39FF1444;transform:translateY(-2px);}
        .lg-hamburger{display:none;flex-direction:column;gap:5px;background:none;border:none;cursor:pointer;padding:8px;z-index:600;}
        .lg-hamburger span{display:block;width:22px;height:2px;background:var(--text);border-radius:99px;transition:transform .3s,opacity .3s;}
        .lg-hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg);}
        .lg-hamburger.open span:nth-child(2){opacity:0;}
        .lg-hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}
        .lg-mobile-menu{position:fixed;inset:0;z-index:490;background:rgba(4,4,6,.97);backdrop-filter:blur(24px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;opacity:0;pointer-events:none;transition:opacity .3s ease;}
        .lg-mobile-menu.open{opacity:1;pointer-events:auto;}
        .lg-mobile-menu a{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:34px;letter-spacing:.04em;text-transform:uppercase;color:var(--text);text-decoration:none;padding:10px 0;transition:color .2s;}
        .lg-mobile-menu a:hover{color:var(--accent)}
        .lg-mob-cta{margin-top:20px;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;letter-spacing:.1em;text-transform:uppercase;padding:14px 40px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;}
        @media(max-width:640px){#lg-nav{padding:0 20px}.lg-nav-links{display:none}.lg-hamburger{display:flex}}
        #lg-hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        #lg-canvas{position:absolute;inset:0;width:100%;height:100%;}
        .lg-hero-spotlight{position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;transition:opacity .6s ease;}
        .lg-dot-grid{position:absolute;inset:0;pointer-events:none;z-index:2;background-image:radial-gradient(rgba(57,255,20,.15) 1px,transparent 1px);background-size:32px 32px;-webkit-mask-image:radial-gradient(ellipse 80% 80% at 50% 45%,black,transparent);mask-image:radial-gradient(ellipse 80% 80% at 50% 45%,black,transparent);}
        .lg-blob{position:absolute;border-radius:50%;filter:blur(110px);pointer-events:none;animation:lg-blobFloat 12s ease-in-out infinite;}
        @keyframes lg-blobFloat{0%,100%{transform:translate(0,0) scale(1)}35%{transform:translate(28px,-36px) scale(1.06)}70%{transform:translate(-18px,22px) scale(.96)}}
        .lg-hero-content{position:relative;z-index:10;text-align:center;padding:120px 24px 80px;max-width:1000px;margin:0 auto;}
        .lg-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#39FF1410;border:1px solid #39FF1430;border-radius:99px;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:28px;animation:lg-fadeUp .6s ease .1s both;}
        .lg-live-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:lg-livePulse 1.4s ease-in-out infinite;display:inline-block;}
        @keyframes lg-livePulse{0%,100%{box-shadow:0 0 0 0 #39FF1488}50%{box-shadow:0 0 0 6px transparent}}
        .lg-hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(64px,11vw,130px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;animation:lg-fadeUp .7s ease .2s both;margin-bottom:10px;}
        .lg-hero-title .lg-line2{background:linear-gradient(90deg,var(--accent),#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 30px #39FF1466);}
        .lg-hero-sub{font-size:clamp(15px,2vw,20px);color:rgba(238,238,245,0.85);line-height:1.7;max-width:580px;margin:0 auto 44px;animation:lg-fadeUp .7s ease .35s both;}
        .lg-hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;animation:lg-fadeUp .7s ease .5s both;margin-bottom:56px;}
        .lg-btn-primary{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:17px;letter-spacing:.08em;text-transform:uppercase;padding:16px 40px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;position:relative;overflow:hidden;transition:box-shadow .25s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-primary:hover{box-shadow:0 0 36px #39FF1488,0 8px 32px #39FF1444;transform:translateY(-2px)}
        .lg-btn-primary::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.18),transparent);opacity:0;transition:opacity .3s;}.lg-btn-primary:hover::before{opacity:1;}
        .lg-btn-ghost{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:17px;letter-spacing:.08em;text-transform:uppercase;padding:16px 40px;border-radius:10px;cursor:pointer;background:transparent;color:var(--text);border:1px solid var(--border);transition:border-color .2s,background .2s,transform .2s;text-decoration:none;display:inline-block;}
        .lg-btn-ghost:hover{border-color:#39FF1466;background:#39FF1408;transform:translateY(-2px)}
        .lg-hero-trust{display:flex;gap:28px;justify-content:center;flex-wrap:wrap;animation:lg-fadeUp .7s ease .65s both;}
        .lg-trust-item{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--sub);font-weight:500;}
        .lg-trust-check{width:18px;height:18px;border-radius:50%;background:#39FF1420;border:1px solid #39FF1440;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--accent);}
        @keyframes lg-fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes lg-fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes lg-glow{0%,100%{box-shadow:0 0 16px #39FF1466,0 0 40px #39FF1433}50%{box-shadow:0 0 28px #39FF14cc,0 0 64px #39FF1466,0 0 100px #39FF1422}}
        .lg-reveal{opacity:0;transform:translateY(32px);transition:opacity .7s ease,transform .7s ease}
        .lg-reveal.in{opacity:1;transform:translateY(0)}
        .lg-reveal-left{opacity:0;transform:translateX(-32px);transition:opacity .7s ease,transform .7s ease}
        .lg-reveal-left.in{opacity:1;transform:translateX(0)}
        .lg-reveal-right{opacity:0;transform:translateX(32px);transition:opacity .7s ease,transform .7s ease}
        .lg-reveal-right.in{opacity:1;transform:translateX(0)}
        .lg-stagger>*{opacity:0;transform:translateY(20px);transition:opacity .55s ease,transform .55s ease;}
        .lg-stagger.in>*:nth-child(1){opacity:1;transform:none;transition-delay:.04s}
        .lg-stagger.in>*:nth-child(2){opacity:1;transform:none;transition-delay:.12s}
        .lg-stagger.in>*:nth-child(3){opacity:1;transform:none;transition-delay:.20s}
        .lg-stagger.in>*:nth-child(4){opacity:1;transform:none;transition-delay:.28s}
        .lg-stagger.in>*:nth-child(5){opacity:1;transform:none;transition-delay:.36s}
        .lg-stagger.in>*:nth-child(6){opacity:1;transform:none;transition-delay:.44s}
        .lg-section{padding:100px 48px;max-width:1160px;margin:0 auto}
        .lg-section-head{text-align:center;margin-bottom:72px}
        .lg-label-tag{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;display:inline-flex;align-items:center;gap:8px;}
        .lg-label-tag::before{content:'';width:18px;height:1px;background:var(--accent);box-shadow:0 0 6px var(--accent);}
        .lg-section-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(44px,6vw,82px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;}
        .lg-section-sub{color:var(--sub);font-size:18px;max-width:540px;margin:16px auto 0;line-height:1.65}
        .lg-divider{position:relative;height:2px;margin:0;overflow:visible;background:linear-gradient(90deg,transparent,var(--border),transparent);}
        .lg-divider::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;border:2px solid var(--border);background:var(--bg);}
        #lg-stats{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
        .lg-stats-inner{max-width:1000px;margin:0 auto;padding:56px 48px;display:grid;grid-template-columns:repeat(4,1fr);}
        .lg-stat-item{text-align:center;padding:0 24px;border-right:1px solid var(--border);transition:transform .25s;}
        .lg-stat-item:hover{transform:translateY(-2px)}
        .lg-stat-item:last-child{border-right:none}
        .lg-stat-num{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(44px,6vw,68px);color:var(--accent);line-height:1;text-shadow:0 0 24px #39FF1466;}
        .lg-stat-label{font-size:12px;color:var(--sub);margin-top:6px;letter-spacing:.05em;text-transform:uppercase}
        @media(max-width:640px){.lg-stats-inner{grid-template-columns:repeat(2,1fr);gap:24px 0}.lg-stat-item{border-right:none;border-bottom:1px solid var(--border);padding:24px}.lg-stat-item:nth-child(odd){border-right:1px solid var(--border)}}
        .lg-features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .lg-feat-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:32px 28px;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;transform-style:preserve-3d;}
        .lg-feat-card:hover{transform:translateY(-8px);box-shadow:0 24px 64px rgba(57,255,20,.12),0 0 0 1px #39FF1430;}
        .lg-feat-glow{position:absolute;top:-40px;right:-40px;width:160px;height:160px;border-radius:50%;filter:blur(60px);pointer-events:none;opacity:.25;}
        .lg-feat-tag{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:14px;display:inline-block;}
        .lg-feat-icon{font-size:36px;margin-bottom:14px;}
        .lg-feat-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;text-transform:uppercase;margin-bottom:12px;}
        .lg-feat-desc{font-size:13px;color:var(--sub);line-height:1.7;margin-bottom:18px;}
        .lg-feat-bullets{display:flex;flex-direction:column;gap:8px;}
        .lg-feat-bullet{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--sub);}
        .lg-feat-bullet-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}
        @media(max-width:900px){.lg-features-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:600px){.lg-features-grid{grid-template-columns:1fr}}
        #lg-how{background:var(--bg);position:relative;overflow:hidden;}
        .lg-steps-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:16px;position:relative;z-index:1;}
        .lg-step-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:28px 20px;text-align:center;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;}
        .lg-step-card:hover{transform:translateY(-8px);border-color:#39FF1444;box-shadow:0 20px 56px rgba(57,255,20,.12)}
        .lg-step-num{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sub);margin-bottom:10px;}
        .lg-step-icon{font-size:30px;margin-bottom:12px;}
        .lg-step-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;text-transform:uppercase;margin-bottom:10px;color:var(--text);}
        .lg-step-desc{font-size:12px;color:var(--sub);line-height:1.65}
        .lg-step-connector{position:absolute;top:44px;right:-12px;width:24px;height:1px;background:linear-gradient(90deg,var(--border),transparent);z-index:2;}
        @media(max-width:900px){.lg-steps-grid{grid-template-columns:1fr 1fr}.lg-step-connector{display:none}}
        @media(max-width:480px){.lg-steps-grid{grid-template-columns:1fr}}
        #lg-website-preview{background:var(--surface);position:relative;overflow:hidden;}
        .lg-preview-wrap{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;}
        .lg-preview-copy{max-width:480px;}
        .lg-preview-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(38px,5vw,62px);text-transform:uppercase;line-height:1;margin-bottom:16px;}
        .lg-preview-desc{font-size:15px;color:var(--sub);line-height:1.7;margin-bottom:28px;}
        .lg-preview-pills{display:flex;flex-wrap:wrap;gap:8px;}
        .lg-pill{padding:6px 14px;border-radius:99px;background:var(--card);border:1px solid var(--border);font-size:12px;font-weight:600;color:var(--sub);letter-spacing:.04em;}
        .lg-preview-mock{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:0;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.6);}
        .lg-mock-bar{background:#1A1A28;padding:10px 16px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);}
        .lg-mock-dot{width:10px;height:10px;border-radius:50%;}
        .lg-mock-url{flex:1;background:#0F0F14;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:10px;color:var(--sub);margin:0 10px;font-family:monospace;}
        .lg-mock-body{padding:20px;}
        .lg-mock-league-name{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
        .lg-mock-season{font-size:11px;color:var(--sub);margin-bottom:16px;}
        .lg-mock-tabs{display:flex;gap:2px;margin-bottom:16px;background:#1A1A28;padding:3px;border-radius:8px;}
        .lg-mock-tab{padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;color:var(--sub);cursor:default;}
        .lg-mock-tab.active{background:var(--bg);color:var(--accent);}
        .lg-mock-table{width:100%;border-collapse:collapse;}
        .lg-mock-table th{font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--sub);text-align:left;padding:6px 0;border-bottom:1px solid var(--border);}
        .lg-mock-table td{font-size:12px;padding:8px 0;border-bottom:1px solid #1A1A2810;color:var(--text);}
        .lg-mock-table tr:last-child td{border-bottom:none}
        .lg-mock-dot-g{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px;}
        @media(max-width:768px){.lg-preview-wrap{grid-template-columns:1fr}.lg-preview-copy{max-width:100%}}
        #lg-ratings{background:var(--bg);position:relative;overflow:hidden;}
        .lg-rating-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start;}
        .lg-rating-copy{padding-right:24px;}
        .lg-rating-visual{display:flex;flex-direction:column;gap:12px;}
        .lg-player-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px 20px;display:flex;align-items:center;gap:16px;transition:transform .2s,border-color .25s,box-shadow .25s;}
        .lg-player-card:hover{transform:translateX(6px);border-color:#39FF1444;box-shadow:0 12px 40px rgba(57,255,20,.1);}
        .lg-player-ring{width:54px;height:54px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
        .lg-player-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
        .lg-player-score{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:17px;line-height:1;position:relative;z-index:1;}
        .lg-player-lbl{font-size:7px;font-weight:700;letter-spacing:.1em;opacity:.8;position:relative;z-index:1}
        .lg-player-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;margin-bottom:2px}
        .lg-player-meta{font-size:11px;color:var(--sub);margin-bottom:4px;}
        .lg-player-tier{display:inline-block;border-radius:99px;padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:.04em;}
        .lg-cats{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
        .lg-cat-bar{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--sub);}
        .lg-cat-track{flex:1;height:3px;background:var(--muted);border-radius:99px;overflow:hidden;min-width:60px;}
        .lg-cat-fill{height:100%;border-radius:99px;background:var(--accent);}
        @media(max-width:768px){.lg-rating-grid{grid-template-columns:1fr}}
        #lg-cta{position:relative;overflow:hidden;background:radial-gradient(ellipse 80% 60% at 50% 50%,#39FF1412 0%,transparent 70%),var(--bg);padding:120px 48px;text-align:center;}
        .lg-cta-inner{position:relative;z-index:2;max-width:640px;margin:0 auto}
        .lg-cta-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(48px,8vw,96px);line-height:.95;text-transform:uppercase;margin-bottom:20px;}
        .lg-cta-title span{color:var(--accent);text-shadow:0 0 40px #39FF1466}
        .lg-cta-sub{font-size:18px;color:var(--sub);margin-bottom:44px;line-height:1.6;}
        .lg-cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:24px;}
        .lg-cta-note{font-size:13px;color:var(--sub)}
        .lg-cta-note a{color:var(--accent);text-decoration:none;}.lg-cta-note a:hover{text-decoration:underline;}
        .lg-callout{margin-top:80px;background:linear-gradient(135deg,#39FF1410,#39FF1406);border:1px solid #39FF1430;border-radius:20px;padding:32px 40px;display:flex;align-items:center;gap:24px;max-width:800px;margin-left:auto;margin-right:auto;position:relative;overflow:hidden;}
        .lg-callout::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,#39FF1408,transparent);transform:translateX(-100%);animation:lg-shimmer 3s ease-in-out infinite;}
        @keyframes lg-shimmer{to{transform:translateX(100%)}}
        .lg-callout-icon{font-size:40px;flex-shrink:0;}
        .lg-callout-head{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:24px;margin-bottom:6px;}
        .lg-callout-sub{font-size:14px;color:var(--sub);line-height:1.6;}
        @media(max-width:640px){.lg-callout{flex-direction:column;text-align:center}.lg-section{padding:72px 20px}}
        .lg-tilt{transform-style:preserve-3d;will-change:transform;}
        .lg-tilt:not(:hover){transition:transform .5s cubic-bezier(.16,1,.3,1),border-color .25s,box-shadow .25s;}
        .lg-magnetic{will-change:transform;transition:transform .4s cubic-bezier(.16,1,.3,1),box-shadow .25s !important;}
        footer.lg-footer{background:var(--surface);border-top:1px solid var(--border);padding:40px 48px;text-align:center;}
        .lg-footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;color:var(--accent);text-shadow:0 0 12px #39FF1477;margin-bottom:16px;}
        .lg-footer-links{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
        .lg-footer-links a{font-size:12px;color:var(--sub);letter-spacing:.05em;transition:color .2s;text-decoration:none;}
        .lg-footer-links a:hover{color:var(--text)}
        .lg-footer-copy{font-size:11px;color:var(--muted)}
        @media(max-width:500px){.lg-section{padding:72px 20px}}
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
        <button
          className={`lg-hamburger${menuOpen ? ' open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      <div className={`lg-mobile-menu${menuOpen ? ' open' : ''}`}>
        <a href="/#how" onClick={closeMenu}>How It Works</a>
        <a href="/#scale" onClick={closeMenu}>Rating Scale</a>
        <a href="/leagues" onClick={closeMenu}>Leagues</a>
        <a href="/faq" onClick={closeMenu}>FAQ</a>
        <a href="/league-portal/signup" onClick={closeMenu}>
          <button className="lg-mob-cta">Start Free</button>
        </a>
      </div>

      {/* ── HERO ── */}
      <section id="lg-hero">
        <canvas id="lg-canvas" />
        <div className="lg-dot-grid" />
        <div id="lg-hero-spotlight" className="lg-hero-spotlight" />
        <div className="lg-blob" style={{ width: 700, height: 700, background: 'rgba(57,255,20,0.11)', top: '-20%', right: '-14%', animationDuration: '14s' }} />
        <div className="lg-blob" style={{ width: 450, height: 450, background: 'rgba(0,204,34,0.06)', bottom: '-5%', left: '-10%', animationDuration: '10s', animationDelay: '-4s' }} />

        <div className="lg-hero-content">
          <div className="lg-eyebrow">
            <span className="lg-live-dot" />
            Free for League Owners
          </div>
          <h1 className="lg-hero-title">
            Run Your<br />
            <span className="lg-line2">League Right.</span>
          </h1>
          <p className="lg-hero-sub">
            The complete league management platform for basketball organizers. Smart scheduling, live standings, full stat tracking, and a free public website — all in one place.
          </p>
          <div className="lg-hero-btns">
            <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic">Start Free Today</a>
            <a href="#lg-features" className="lg-btn-ghost lg-magnetic">See All Features</a>
          </div>
          <div className="lg-hero-trust">
            {[
              'Free forever for league owners',
              'No credit card required',
              'Set up in under 5 minutes',
            ].map(t => (
              <div className="lg-trust-item" key={t}>
                <div className="lg-trust-check">✓</div>
                {t}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <div id="lg-stats">
        <div className="lg-stats-inner">
          <div className="lg-stat-item lg-reveal">
            <div className="lg-stat-num"><span className="lg-ctr" data-t="0">0</span>min</div>
            <div className="lg-stat-label">To First Schedule</div>
          </div>
          <div className="lg-stat-item lg-reveal" style={{ transitionDelay: '.1s' }}>
            <div className="lg-stat-num"><span className="lg-ctr" data-t="6">0</span></div>
            <div className="lg-stat-label">Core Features</div>
          </div>
          <div className="lg-stat-item lg-reveal" style={{ transitionDelay: '.2s' }}>
            <div className="lg-stat-num"><span className="lg-ctr" data-t="100">0</span>%</div>
            <div className="lg-stat-label">Free for Organizers</div>
          </div>
          <div className="lg-stat-item lg-reveal" style={{ transitionDelay: '.3s' }}>
            <div className="lg-stat-num"><span className="lg-ctr" data-t="0">0</span>+</div>
            <div className="lg-stat-label">Active Leagues</div>
          </div>
        </div>
      </div>

      <div className="lg-divider" />

      {/* ── FEATURES GRID ── */}
      <section id="lg-features" style={{ background: 'var(--bg)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 500, height: 500, background: 'rgba(57,255,20,0.09)', top: '10%', right: '-12%', animationDuration: '16s', animationDelay: '-6s' }} />
        <div className="lg-section">
          <div className="lg-section-head">
            <span className="lg-label-tag lg-reveal">Everything Included</span>
            <h2 className="lg-section-title lg-reveal">Built for Organizers.</h2>
            <p className="lg-section-sub lg-reveal">Every tool you need to run a real league — from the first whistle to the final trophy.</p>
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
                      <div className="lg-feat-bullet-dot" style={{ background: f.accent }} />
                      {b}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="lg-divider" />

      {/* ── HOW IT WORKS ── */}
      <section id="lg-how" style={{ background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
        <div className="lg-blob" style={{ width: 400, height: 400, background: 'rgba(57,255,20,0.08)', bottom: '0', left: '-8%', animationDuration: '13s', animationDelay: '-3s' }} />
        <div className="lg-section">
          <div className="lg-section-head">
            <span className="lg-label-tag lg-reveal">Get Started</span>
            <h2 className="lg-section-title lg-reveal">Live in 5 Steps.</h2>
            <p className="lg-section-sub lg-reveal">From sign-up to first game in minutes. No setup calls, no onboarding decks — just log in and go.</p>
          </div>
          <div className="lg-steps-grid lg-stagger">
            {steps.map((s, i) => (
              <div className="lg-step-card lg-tilt" key={s.num}>
                {i < steps.length - 1 && <div className="lg-step-connector" />}
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

      {/* ── FREE WEBSITE PREVIEW ── */}
      <section id="lg-website-preview" style={{ background: 'var(--bg)' }}>
        <div className="lg-blob" style={{ width: 500, height: 500, background: 'rgba(74,158,255,0.06)', top: '20%', right: '-10%', animationDuration: '15s', animationDelay: '-5s' }} />
        <div className="lg-section">
          <div className="lg-preview-wrap">
            <div className="lg-preview-copy">
              <span className="lg-label-tag lg-reveal">Free League Website</span>
              <h2 className="lg-preview-title lg-reveal">Your League.<br />Online. Instantly.</h2>
              <p className="lg-preview-desc lg-reveal">
                Every league gets a free public website with a custom URL. Share it with players and fans — live standings, full schedule, and player leaderboards, updated the second you enter a score.
              </p>
              <div className="lg-preview-pills lg-reveal">
                {['Custom URL', 'Live standings', 'Player stats', 'Custom colors', 'Mobile-ready', 'No coding'].map(p => (
                  <span className="lg-pill" key={p}>{p}</span>
                ))}
              </div>
            </div>
            <div className="lg-preview-mock lg-reveal-right" style={{ transitionDelay: '.15s' }}>
              <div className="lg-mock-bar">
                <div className="lg-mock-dot" style={{ background: '#FF5F57' }} />
                <div className="lg-mock-dot" style={{ background: '#FEBC2E' }} />
                <div className="lg-mock-dot" style={{ background: '#28C840' }} />
                <div className="lg-mock-url">netr.app/league/your-league-name</div>
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
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th>W</th>
                      <th>L</th>
                      <th>PTS</th>
                    </tr>
                  </thead>
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

      {/* ── NETR RATINGS ── */}
      <section id="lg-ratings" style={{ background: 'var(--surface)' }}>
        <div className="lg-blob" style={{ width: 450, height: 450, background: 'rgba(255,122,0,0.07)', top: '10%', right: '-8%', animationDuration: '14s', animationDelay: '-2s' }} />
        <div className="lg-section">
          <div className="lg-rating-grid">
            <div className="lg-rating-copy">
              <span className="lg-label-tag lg-reveal">NETR Rating</span>
              <h2 className="lg-preview-title lg-reveal">Every Player<br />Gets Rated.</h2>
              <p className="lg-preview-desc lg-reveal">
                Players in your league earn a real NETR score — the same verified rating used across all pickup and league play. It's peer-verified, skill-based, and carries everywhere they play on NETR.
              </p>
              <div className="lg-feat-bullets lg-reveal" style={{ gap: '12px', marginBottom: '28px' }}>
                {[
                  { label: 'Skill ratings across 7 categories', color: '#39FF14' },
                  { label: 'Vibe score tracks court conduct', color: '#F5C542' },
                  { label: 'Ratings carry across all leagues', color: '#4A9EFF' },
                  { label: 'Builds verified basketball reputation', color: '#FF7A00' },
                ].map(b => (
                  <div className="lg-feat-bullet" key={b.label} style={{ fontSize: '14px' }}>
                    <div className="lg-feat-bullet-dot" style={{ background: b.color, width: 8, height: 8 }} />
                    {b.label}
                  </div>
                ))}
              </div>
              <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic lg-reveal">Get Started Free</a>
            </div>
            <div className="lg-rating-visual lg-reveal-right" style={{ transitionDelay: '.1s' }}>
              {[
                { name: 'Marcus J.', meta: 'PG · Bronx', score: 7.4, color: '#FF7A00', tier: 'Built Different', tierBg: '#FF7A0020', bars: [82, 74, 91, 68, 55, 88, 79] },
                { name: 'Deja W.', meta: 'SF · Harlem', score: 6.1, color: '#39FF14', tier: 'Hooper', tierBg: '#39FF1420', bars: [78, 82, 65, 70, 74, 80, 72] },
                { name: 'Chris B.', meta: 'C · Brooklyn', score: 5.3, color: '#2ECC71', tier: 'Got Game', tierBg: '#2ECC7120', bars: [55, 88, 48, 60, 91, 65, 82] },
              ].map(p => (
                <div className="lg-player-card lg-tilt" key={p.name}>
                  <div className="lg-player-ring">
                    <svg viewBox="0 0 54 54">
                      <circle cx="27" cy="27" r="23" fill="none" stroke="#1A1A28" strokeWidth="3" />
                      <circle cx="27" cy="27" r="23" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round"
                        strokeDasharray="144.5"
                        strokeDashoffset={String(144.5 - (144.5 * p.score / 10))}
                        style={{ filter: `drop-shadow(0 0 4px ${p.color})` }}
                      />
                    </svg>
                    <div className="lg-player-score" style={{ color: p.color }}>{p.score}</div>
                    <div className="lg-player-lbl" style={{ color: p.color }}>NETR</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="lg-player-name">{p.name}</div>
                    <div className="lg-player-meta">{p.meta}</div>
                    <div className="lg-player-tier" style={{ background: p.tierBg, color: p.color, border: `1px solid ${p.color}40` }}>{p.tier}</div>
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {['SHT', 'DEF', 'HND', 'PLY', 'REB', 'IQ', 'FIN'].map((cat, ci) => (
                        <div className="lg-cat-bar" key={cat}>
                          <span style={{ width: 26 }}>{cat}</span>
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

      {/* ── CTA ── */}
      <section id="lg-cta">
        <div className="lg-blob" style={{ width: 600, height: 600, background: 'rgba(57,255,20,0.1)', top: '-10%', left: '50%', transform: 'translateX(-50%)', animationDuration: '12s' }} />
        <div className="lg-cta-inner">
          <h2 className="lg-cta-title lg-reveal">
            Ready to<br /><span>Run Your League?</span>
          </h2>
          <p className="lg-cta-sub lg-reveal" style={{ transitionDelay: '.1s' }}>
            Free to start. No credit card. No setup fees. Just a better way to run basketball.
          </p>
          <div className="lg-cta-btns lg-reveal" style={{ transitionDelay: '.2s' }}>
            <a href="/league-portal/signup" className="lg-btn-primary lg-magnetic" style={{ fontSize: 18, padding: '18px 48px' }}>
              Create Your League
            </a>
            <a href="/league-portal/login" className="lg-btn-ghost lg-magnetic" style={{ fontSize: 18, padding: '18px 48px' }}>
              Sign In
            </a>
          </div>
          <p className="lg-cta-note lg-reveal" style={{ transitionDelay: '.3s' }}>
            Already have an account? <a href="/league-portal/login">Sign in here</a> · Questions? Check the <a href="/faq">FAQ</a>
          </p>

          <div className="lg-callout lg-reveal" style={{ transitionDelay: '.4s' }}>
            <div className="lg-callout-icon">🏀</div>
            <div>
              <div className="lg-callout-head">Free for League Organizers. Always.</div>
              <div className="lg-callout-sub">
                NETR Leagues is completely free for the people who run leagues. We believe organizers are the backbone of community basketball — and they deserve great tools without a price tag.
              </div>
            </div>
          </div>
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
          <a href="/league-portal/signup">Start Free</a>
        </div>
        <p className="lg-footer-copy">© 2026 NETR. Built for organizers. Free for the culture.</p>
      </footer>
    </>
  )
}
