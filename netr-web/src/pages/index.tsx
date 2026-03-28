import Head from 'next/head'
import { useEffect } from 'react'

const TESTFLIGHT_URL = process.env.NEXT_PUBLIC_TESTFLIGHT_URL || 'https://testflight.apple.com/join/REPLACE_ME'

export default function Home() {
  useEffect(() => {
    // LOADER
    const lbar = document.getElementById('lbar') as HTMLElement
    const loader = document.getElementById('loader') as HTMLElement
    let prog = 0
    const loadInt = setInterval(() => {
      prog += Math.random() * 18 + 4
      if (prog >= 100) { prog = 100; clearInterval(loadInt); setTimeout(() => loader.classList.add('out'), 300) }
      lbar.style.width = prog + '%'
    }, 60)

    // CURSOR
    const cur = document.getElementById('cursor') as HTMLElement
    const trail = document.getElementById('cursor-trail') as HTMLElement
    let mx = 0, my = 0, tx = 0, ty = 0
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; cur.style.left = mx+'px'; cur.style.top = my+'px' }
    document.addEventListener('mousemove', onMove)
    let rafT: number
    const animTrail = () => { tx += (mx-tx)*.14; ty += (my-ty)*.14; trail.style.left=tx+'px'; trail.style.top=ty+'px'; rafT=requestAnimationFrame(animTrail) }
    rafT = requestAnimationFrame(animTrail)

    // COURT CANVAS
    const heroCanvas = document.getElementById('court-canvas') as HTMLCanvasElement
    const hCtx = heroCanvas.getContext('2d')!
    const resize = () => { heroCanvas.width = heroCanvas.offsetWidth; heroCanvas.height = heroCanvas.offsetHeight }
    resize(); window.addEventListener('resize', resize)

    const wCanvas = document.getElementById('waitlist-canvas') as HTMLCanvasElement
    const wCtx = wCanvas.getContext('2d')!
    const resizeW = () => { wCanvas.width = wCanvas.offsetWidth; wCanvas.height = wCanvas.offsetHeight }
    resizeW(); window.addEventListener('resize', resizeW)

    const balls = Array.from({length:8}, () => ({
      x: Math.random()*window.innerWidth, y: Math.random()*window.innerHeight,
      vx: (Math.random()-.5)*.6, vy: (Math.random()-.5)*.6,
      r: 6+Math.random()*6, alpha: .08+Math.random()*.12, phase: Math.random()*Math.PI*2
    }))

    function drawCourt(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number) {
      ctx.clearRect(0,0,w,h)
      const cx=w/2, cy=h/2, scale=Math.min(w,h)*.42
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,scale*1.4)
      bg.addColorStop(0,'rgba(57,255,20,0.04)'); bg.addColorStop(1,'transparent')
      ctx.fillStyle=bg; ctx.fillRect(0,0,w,h)
      ctx.save(); ctx.translate(cx,cy)
      const a = (v: number) => `rgba(57,255,20,${v*progress})`
      const lw = 1.5
      function arc(x:number,y:number,r:number,s:number,e:number,ac=false){ctx.beginPath();ctx.arc(x,y,r,s,e,ac);ctx.stroke()}
      ctx.lineWidth=lw
      const bw=scale*.88, bh=scale*1.55
      ctx.strokeStyle=a(.25); ctx.strokeRect(-bw/2,-bh/2,bw,bh)
      ctx.strokeStyle=a(.18); ctx.beginPath();ctx.moveTo(-bw/2,0);ctx.lineTo(bw/2,0);ctx.stroke()
      ctx.strokeStyle=a(.2); arc(0,0,scale*.16,0,Math.PI*2)
      ctx.strokeStyle=a(.35); ctx.lineWidth=lw*2; arc(0,0,3,0,Math.PI*2); ctx.lineWidth=lw
      const kw=scale*.36, kh=scale*.44
      ctx.strokeStyle=a(.22); ctx.strokeRect(-kw/2,-bh/2,kw,kh); ctx.strokeRect(-kw/2,bh/2-kh,kw,kh)
      ctx.strokeStyle=a(.16)
      arc(0,-bh/2+kh,scale*.18,0,Math.PI,false); ctx.setLineDash([6,6]); arc(0,-bh/2+kh,scale*.18,Math.PI,Math.PI*2); ctx.setLineDash([])
      arc(0,bh/2-kh,scale*.18,Math.PI,Math.PI*2); ctx.setLineDash([6,6]); arc(0,bh/2-kh,scale*.18,0,Math.PI); ctx.setLineDash([])
      ctx.strokeStyle=a(.22); ctx.lineWidth=lw*1.4
      const tR=scale*.58, cX=scale*.28, cY=-bh/2+scale*.12
      ctx.beginPath();ctx.moveTo(-cX,-bh/2);ctx.lineTo(-cX,cY);ctx.stroke()
      ctx.beginPath();ctx.moveTo(cX,-bh/2);ctx.lineTo(cX,cY);ctx.stroke()
      const aa=Math.asin(cX/tR)
      arc(0,-bh/2+scale*.05,tR,Math.PI+aa,Math.PI*2-aa)
      ctx.beginPath();ctx.moveTo(-cX,bh/2);ctx.lineTo(-cX,-cY);ctx.stroke()
      ctx.beginPath();ctx.moveTo(cX,bh/2);ctx.lineTo(cX,-cY);ctx.stroke()
      arc(0,bh/2-scale*.05,tR,aa,Math.PI-aa)
      ctx.lineWidth=lw; ctx.strokeStyle=a(.4); ctx.lineWidth=lw*2
      arc(0,-bh/2+scale*.06,scale*.038,0,Math.PI*2); arc(0,bh/2-scale*.06,scale*.038,0,Math.PI*2)
      ctx.lineWidth=lw*2.5
      ctx.beginPath();ctx.moveTo(-scale*.08,-bh/2+scale*.02);ctx.lineTo(scale*.08,-bh/2+scale*.02);ctx.stroke()
      ctx.beginPath();ctx.moveTo(-scale*.08,bh/2-scale*.02);ctx.lineTo(scale*.08,bh/2-scale*.02);ctx.stroke()
      ctx.lineWidth=lw; ctx.strokeStyle=a(.14)
      arc(0,-bh/2+scale*.06,scale*.1,0,Math.PI); arc(0,bh/2-scale*.06,scale*.1,Math.PI,Math.PI*2)
      ctx.restore()
      balls.forEach(b => {
        b.phase+=.018; b.x+=b.vx; b.y+=b.vy
        if(b.x<-20)b.x=w+20; if(b.x>w+20)b.x=-20; if(b.y<-20)b.y=h+20; if(b.y>h+20)b.y=-20
        const pulse=b.alpha+Math.sin(b.phase)*b.alpha*.5
        ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fillStyle=`rgba(57,255,20,${pulse*progress})`;ctx.fill()
        const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r*3)
        g.addColorStop(0,`rgba(57,255,20,${pulse*.4*progress})`);g.addColorStop(1,'transparent')
        ctx.beginPath();ctx.arc(b.x,b.y,b.r*3,0,Math.PI*2);ctx.fillStyle=g;ctx.fill()
      })
    }

    // RING ANIMATION
    function animRing(arcId: string, scoreId: string, target: number, delay: number) {
      setTimeout(() => {
        const arcEl = document.getElementById(arcId) as unknown as SVGCircleElement
        const scoreEl = document.getElementById(scoreId) as HTMLElement
        const dur=2000, start=performance.now()
        const step=(now:number)=>{
          const p=Math.min((now-start)/dur,1), e=1-Math.pow(1-p,4)
          arcEl.style.strokeDashoffset=String(150.8-(150.8*(target/10)*e))
          scoreEl.textContent=(e*target).toFixed(1)
          if(p<1)requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }, delay)
    }

    // MAIN LOOP
    let cp=0, rafM: number
    const loop=()=>{ if(cp<1){cp+=.012;if(cp>1)cp=1} drawCourt(hCtx,heroCanvas.width,heroCanvas.height,cp); drawCourt(wCtx,wCanvas.width,wCanvas.height,.6); rafM=requestAnimationFrame(loop) }
    rafM=requestAnimationFrame(loop)

    // NAVBAR
    const nav=document.getElementById('nav') as HTMLElement
    const onScroll=()=>nav.classList.toggle('scrolled',window.scrollY>50)
    window.addEventListener('scroll',onScroll,{passive:true})

    // SCROLL REVEAL
    const ro=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');if((e.target as HTMLElement).id==='stepLine')e.target.classList.add('lit');ro.unobserve(e.target)}})},{threshold:0.1})
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(el=>ro.observe(el))
    const sl=document.getElementById('stepLine'); if(sl)ro.observe(sl)

    // COUNT UP
    const co=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){const el=e.target as HTMLElement,t=parseInt(el.dataset.t||'0'),dur=1800,s=performance.now();const step=(now:number)=>{const p=Math.min((now-s)/dur,1),ea=1-Math.pow(1-p,3);el.textContent=Math.round(ea*t).toLocaleString();if(p<1)requestAnimationFrame(step)};requestAnimationFrame(step);co.unobserve(e.target)}})},{threshold:.5})
    document.querySelectorAll('.ctr[data-t]').forEach(el=>co.observe(el))

    // RINGS
    setTimeout(()=>{animRing('arc1','score1',6.8,600);animRing('arc2','score2',8.4,900);animRing('arc3','score3',7.9,1200)},1200)

    // SMOOTH SCROLL
    document.querySelectorAll('a[href^="#"]').forEach(a=>{a.addEventListener('click',e=>{const t=document.querySelector(a.getAttribute('href')||'');if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'})}})})

    return () => { clearInterval(loadInt); cancelAnimationFrame(rafM); cancelAnimationFrame(rafT); document.removeEventListener('mousemove',onMove); window.removeEventListener('scroll',onScroll); window.removeEventListener('resize',resize); window.removeEventListener('resize',resizeW) }
  }, [])

  const submitWait = (e: React.FormEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).style.display='none'
    const s=document.getElementById('success'); if(s)s.style.display='block'
  }

  return (
    <>
      <Head>
        <title>NETR — Your Rep. Built on the Court.</title>
        <meta name="description" content="The first peer-to-peer basketball rating system. Play. Get rated. Build your verified score." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#040406;--surface:#08080D;--card:#0D0D14;--border:#1A1A28;--accent:#39FF14;--gold:#F5C542;--red:#FF453A;--blue:#4A9EFF;--text:#EEEEF5;--sub:#5A5A78;--muted:#222232;}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow-x:hidden;cursor:none}
        #cursor{position:fixed;width:20px;height:20px;border-radius:50%;background:var(--accent);pointer-events:none;z-index:9999;transform:translate(-50%,-50%);box-shadow:0 0 12px var(--accent),0 0 30px #39FF1466;transition:width .15s,height .15s,background .15s;mix-blend-mode:screen;}
        #cursor-trail{position:fixed;width:40px;height:40px;border-radius:50%;border:1px solid #39FF1455;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);}
        body:has(a:hover) #cursor,body:has(button:hover) #cursor{width:36px;height:36px;background:#fff;}
        #grain{position:fixed;inset:0;pointer-events:none;z-index:1000;opacity:.028;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");background-size:180px;}
        #loader{position:fixed;inset:0;z-index:9000;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;transition:opacity .5s ease;}
        #loader.out{opacity:0;pointer-events:none}
        .loader-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:64px;color:var(--accent);text-shadow:0 0 40px #39FF14cc;animation:glow 1.5s ease-in-out infinite;}
        .loader-bar-wrap{width:200px;height:2px;background:var(--border);border-radius:99px;overflow:hidden}
        .loader-bar{height:100%;background:var(--accent);width:0;border-radius:99px;box-shadow:0 0 8px var(--accent);transition:width .05s linear}
        #nav{position:fixed;top:0;left:0;right:0;z-index:500;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;transition:background .3s,border-color .3s;border-bottom:1px solid transparent;}
        #nav.scrolled{background:rgba(4,4,6,.92);backdrop-filter:blur(24px);border-bottom-color:var(--border);}
        .nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:30px;color:var(--accent);text-shadow:0 0 16px #39FF1499;letter-spacing:.02em;position:relative;}
        .nav-logo::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--accent);box-shadow:0 0 8px var(--accent);transform:scaleX(0);transform-origin:left;transition:transform .3s ease;}
        .nav-logo:hover::after{transform:scaleX(1)}
        .nav-links{display:flex;align-items:center;gap:36px}
        .nav-links a{font-size:12px;font-weight:600;color:var(--sub);letter-spacing:.1em;text-transform:uppercase;transition:color .2s;text-decoration:none;}
        .nav-links a:hover{color:var(--text)}
        .btn-cta{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;transition:box-shadow .25s,transform .2s;}
        .btn-cta:hover{box-shadow:0 0 28px #39FF1488,0 6px 24px #39FF1444;transform:translateY(-2px);}
        @media(max-width:640px){#nav{padding:0 20px}.nav-links a{display:none}}
        #hero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;overflow:hidden;}
        #court-canvas{position:absolute;inset:0;width:100%;height:100%;}
        .hero-content{position:relative;z-index:10;text-align:center;padding:120px 24px 80px;max-width:960px;margin:0 auto;}
        .hero-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#39FF1410;border:1px solid #39FF1430;border-radius:99px;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:28px;animation:fadeUp .6s ease .1s both;}
        .live-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);animation:livePulse 1.4s ease-in-out infinite;display:inline-block;}
        @keyframes livePulse{0%,100%{box-shadow:0 0 0 0 #39FF1488}50%{box-shadow:0 0 0 6px transparent}}
        .hero-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(72px,12vw,140px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;animation:fadeUp .7s ease .2s both;margin-bottom:10px;}
        .hero-title .line2{background:linear-gradient(90deg,var(--accent),#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 30px #39FF1466);}
        .hero-sub{font-size:clamp(15px,2vw,19px);color:#fff;line-height:1.7;max-width:540px;margin:0 auto 44px;animation:fadeUp .7s ease .35s both;}
        .hero-btns{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;animation:fadeUp .7s ease .5s both;margin-bottom:64px;}
        .btn-primary{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;letter-spacing:.08em;text-transform:uppercase;padding:15px 36px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;position:relative;overflow:hidden;transition:box-shadow .25s,transform .2s;}
        .btn-primary:hover{box-shadow:0 0 36px #39FF1488,0 8px 32px #39FF1444;transform:translateY(-2px)}
        .btn-ghost{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:16px;letter-spacing:.08em;text-transform:uppercase;padding:15px 36px;border-radius:10px;cursor:pointer;background:transparent;color:var(--text);border:1px solid var(--border);transition:border-color .2s,background .2s,transform .2s;}
        .btn-ghost:hover{border-color:#39FF1466;background:#39FF1408;transform:translateY(-2px)}
        .score-badges{display:flex;gap:20px;justify-content:center;flex-wrap:wrap;animation:fadeUp .7s ease .65s both;}
        .score-badge-card{background:rgba(13,13,20,.85);backdrop-filter:blur(16px);border:1px solid var(--border);border-radius:16px;padding:14px 20px;display:flex;align-items:center;gap:14px;transition:transform .2s,border-color .2s,box-shadow .2s;}
        .score-badge-card:hover{transform:translateY(-4px);border-color:#39FF1444;box-shadow:0 12px 40px rgba(57,255,20,.1);}
        .netr-ring{width:56px;height:56px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;flex-shrink:0;}
        .netr-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
        .netr-ring-num{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:18px;line-height:1;position:relative;z-index:1;}
        .netr-ring-lbl{font-size:7px;font-weight:700;letter-spacing:.1em;opacity:.8;position:relative;z-index:1}
        .badge-info-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;margin-bottom:2px}
        .badge-info-meta{font-size:11px;color:var(--sub)}
        .badge-tier{display:inline-block;margin-top:5px;border-radius:99px;padding:2px 9px;font-size:10px;font-weight:700;letter-spacing:.05em;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes glow{0%,100%{box-shadow:0 0 16px #39FF1466,0 0 40px #39FF1433}50%{box-shadow:0 0 28px #39FF14cc,0 0 64px #39FF1466,0 0 100px #39FF1422}}
        .reveal{opacity:0;transform:translateY(32px);transition:opacity .7s ease,transform .7s ease}
        .reveal.in{opacity:1;transform:translateY(0)}
        .section{padding:100px 48px;max-width:1120px;margin:0 auto}
        .section-head{text-align:center;margin-bottom:64px}
        .label-tag{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:12px;display:block;}
        .section-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(44px,6vw,80px);line-height:1;letter-spacing:-.01em;text-transform:uppercase;}
        .section-sub{color:var(--sub);font-size:17px;max-width:520px;margin:16px auto 0;line-height:1.65}
        .court-divider{position:relative;height:2px;margin:0;overflow:visible;background:linear-gradient(90deg,transparent,var(--border),transparent);}
        .court-divider::after{content:'';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:48px;height:48px;border-radius:50%;border:2px solid var(--border);background:var(--bg);}
        #stats{background:var(--surface);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
        .stats-inner{max-width:1000px;margin:0 auto;padding:56px 48px;display:grid;grid-template-columns:repeat(4,1fr);}
        .stat-item{text-align:center;padding:0 24px;border-right:1px solid var(--border);}
        .stat-item:last-child{border-right:none}
        .stat-num{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(44px,6vw,68px);color:var(--accent);line-height:1;text-shadow:0 0 24px #39FF1466;}
        .stat-label{font-size:12px;color:var(--sub);margin-top:6px;letter-spacing:.05em;text-transform:uppercase}
        @media(max-width:640px){.stats-inner{grid-template-columns:repeat(2,1fr);gap:24px 0}.stat-item{border-right:none;border-bottom:1px solid var(--border);padding:24px}.stat-item:nth-child(odd){border-right:1px solid var(--border)}}
        #how{background:var(--bg)}
        .steps-wrap{position:relative}
        .steps-line{position:absolute;top:52px;left:calc(12.5% + 28px);right:calc(12.5% + 28px);height:1px;background:linear-gradient(90deg,transparent,var(--border) 20%,var(--border) 80%,transparent);pointer-events:none;}
        .steps-line-glow{position:absolute;top:52px;left:calc(12.5% + 28px);height:1px;width:0;background:linear-gradient(90deg,var(--accent),#00CC22);box-shadow:0 0 8px var(--accent);transition:width 2s cubic-bezier(.16,1,.3,1);}
        .steps-line-glow.lit{width:calc(75% - 56px)}
        .steps-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;position:relative;z-index:1;}
        .step-card{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:28px 22px;text-align:center;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;}
        .step-card:hover{transform:translateY(-8px);border-color:#39FF1444;box-shadow:0 20px 56px rgba(57,255,20,.12)}
        .step-card.featured{border-color:#39FF1444;background:linear-gradient(160deg,#39FF1410,var(--card))}
        .step-icon-wrap{width:60px;height:60px;border-radius:50%;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:26px;}
        .step-card.featured .step-icon-wrap{background:#39FF1418;border-color:#39FF1466}
        .step-num{font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--sub);margin-bottom:8px;}
        .step-card.featured .step-num{color:var(--accent)}
        .step-name{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;text-transform:uppercase;margin-bottom:12px;}
        .step-desc{font-size:13px;color:var(--sub);line-height:1.65}
        .step-note{margin-top:14px;padding:10px 12px;border-radius:10px;background:var(--surface);border-left:2px solid var(--accent);font-size:11px;color:var(--sub);font-style:italic;text-align:left;line-height:1.5;}
        .callout-bar{margin-top:40px;background:linear-gradient(135deg,#39FF1410,#39FF1406);border:1px solid #39FF1430;border-radius:18px;padding:24px 32px;display:flex;align-items:center;gap:20px;}
        .callout-text-head{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:22px;margin-bottom:4px;}
        .callout-text-sub{font-size:14px;color:var(--sub)}
        @media(max-width:900px){.steps-grid{grid-template-columns:repeat(2,1fr)}.steps-line,.steps-line-glow{display:none}}
        @media(max-width:480px){.steps-grid{grid-template-columns:1fr}}
        #scale{background:var(--surface)}
        .tier-list{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:8px}
        .tier-row{display:flex;align-items:center;gap:16px;padding:14px 20px;border-radius:14px;background:var(--card);border:1px solid var(--border);transition:transform .2s;cursor:default;position:relative;overflow:hidden;}
        .tier-row:hover{transform:translateX(6px)}
        .tier-range{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:19px;width:68px;flex-shrink:0;}
        .tier-info{flex:1}
        .tier-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;line-height:1}
        .tier-sub{font-size:11px;color:var(--sub);margin-top:2px}
        .tier-bar{height:4px;background:var(--muted);border-radius:99px;overflow:hidden;width:110px;flex-shrink:0}
        .tier-fill{height:100%;border-radius:99px;width:0;transition:width 1.4s cubic-bezier(.16,1,.3,1);}
        .reveal.in .tier-fill{width:var(--w,50%)}
        .avg-badge{display:inline-flex;align-items:center;gap:5px;margin-top:5px;padding:3px 9px;border-radius:99px;background:#7B9FFF22;border:1px solid #7B9FFF66;font-size:10px;font-weight:700;letter-spacing:.08em;color:#7B9FFF;text-transform:uppercase;}
        .avg-dot{width:6px;height:6px;border-radius:50%;background:#7B9FFF;display:inline-block;animation:auraPulse 2s ease-in-out infinite;}
        #vibe{background:var(--bg)}
        .vibe-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .vibe-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:28px 20px;text-align:center;transition:transform .25s;position:relative;overflow:hidden;}
        .vibe-card:hover{transform:translateY(-6px)}
        .vibe-aura{width:16px;height:16px;border-radius:50%;margin:0 auto 16px;animation:auraPulse 2s ease-in-out infinite;}
        @keyframes auraPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.7);opacity:.55}}
        .vibe-score{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;margin-bottom:4px;}
        .vibe-label{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:18px;margin-bottom:8px}
        .vibe-desc{font-size:12px;color:var(--sub);line-height:1.55}
        @media(max-width:640px){.vibe-grid{grid-template-columns:repeat(2,1fr)}}
        #rep{background:var(--surface)}
        .rep-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .rep-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 18px;display:flex;align-items:flex-start;gap:14px;transition:transform .2s,border-color .2s;}
        .rep-card:hover{transform:translateY(-4px);border-color:#39FF1433}
        .rep-icon-wrap{width:40px;height:40px;flex-shrink:0;border-radius:10px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid var(--border);}
        .rep-name{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:16px;margin-bottom:4px}
        .rep-desc{font-size:12px;color:var(--sub);line-height:1.5}
        @media(max-width:640px){.rep-grid{grid-template-columns:1fr 1fr}}
        #waitlist{position:relative;overflow:hidden;background:radial-gradient(ellipse 80% 60% at 50% 50%,#39FF1412 0%,transparent 70%),var(--bg);padding:120px 48px;text-align:center;}
        #waitlist-canvas{position:absolute;inset:0;width:100%;height:100%;opacity:.4}
        .waitlist-inner{position:relative;z-index:2;max-width:580px;margin:0 auto}
        .waitlist-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(48px,7vw,88px);line-height:1;text-transform:uppercase;margin-bottom:16px;}
        .waitlist-title span{color:var(--accent);text-shadow:0 0 40px #39FF1466}
        .waitlist-sub{font-size:17px;color:var(--sub);margin-bottom:40px;line-height:1.65}
        .waitlist-form{display:flex;gap:10px;max-width:460px;margin:0 auto 16px}
        .waitlist-input{flex:1;background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 18px;color:var(--text);font-family:'DM Sans',sans-serif;font-size:15px;outline:none;transition:border-color .2s,box-shadow .2s;}
        .waitlist-input:focus{border-color:#39FF1466;box-shadow:0 0 0 3px #39FF1415}
        .waitlist-input::placeholder{color:var(--sub)}
        .waitlist-note{font-size:12px;color:var(--sub)}
        .success-msg{display:none;color:var(--accent);font-weight:600;font-size:16px;animation:fadeIn .4s ease;margin-top:16px;}
        @media(max-width:500px){.waitlist-form{flex-direction:column}.section{padding:72px 20px}}
        footer{background:var(--surface);border-top:1px solid var(--border);padding:40px 48px;text-align:center;}
        .footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;color:var(--accent);text-shadow:0 0 12px #39FF1477;margin-bottom:16px;}
        .footer-links{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
        .footer-links a{font-size:12px;color:var(--sub);letter-spacing:.05em;transition:color .2s;text-decoration:none;}
        .footer-links a:hover{color:var(--text)}
        .footer-copy{font-size:11px;color:var(--muted)}
        #crews{background:var(--surface)}
        .crews-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .crew-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:28px 20px;text-align:center;transition:transform .25s,border-color .25s,box-shadow .25s;position:relative;overflow:hidden;}
        .crew-card:hover{transform:translateY(-6px);border-color:#39FF1444;box-shadow:0 20px 56px rgba(57,255,20,.1)}
        .crew-icon-wrap{font-size:32px;margin-bottom:14px;}
        .crew-name{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:20px;text-transform:uppercase;margin-bottom:8px;}
        .crew-desc{font-size:13px;color:var(--sub);line-height:1.6}
        @media(max-width:640px){.crews-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:480px){.section{padding:72px 20px}}
      `}</style>

      <div id="grain" />
      <div id="cursor" />
      <div id="cursor-trail" />

      <div id="loader">
        <div className="loader-logo">NETR</div>
        <div className="loader-bar-wrap"><div className="loader-bar" id="lbar" /></div>
      </div>

      <nav id="nav">
        <div className="nav-logo">NETR</div>
        <div className="nav-links">
          <a href="#how">How It Works</a>
          <a href="#scale">Rating Scale</a>
          <a href="#crews">Crews</a>
          <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer"><button className="btn-cta">Get the App</button></a>
        </div>
      </nav>

      <section id="hero">
        <canvas id="court-canvas" />
        <div className="hero-content">
          <div className="hero-eyebrow"><span className="live-dot" />4 Active Games in NYC Right Now</div>
          <h1 className="hero-title">Your Rep.<br /><span className="line2">Built on the Court.</span></h1>
          <p className="hero-sub">The first peer-to-peer basketball rating system. Play pickup. Get rated by teammates. Build a verified score that follows you everywhere.</p>
          <div className="hero-btns">
            <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer"><button className="btn-primary">Download the App</button></a>
            <a href="#how"><button className="btn-ghost">See How It Works</button></a>
          </div>
          <div className="score-badges">
            {([
              {id:'1',target:6.8,color:'#39FF14',name:'Marcus T.',meta:'@marc_t · PG · Harlem',tier:'Hooper'},
              {id:'2',target:8.4,color:'#F5C542',name:'K. Johnson',meta:'@kj_hoops · SF · Brooklyn',tier:'Elite'},
              {id:'3',target:7.9,color:'#FF7A00',name:'D. Williams',meta:'@dre_w · SG · Queens',tier:'Built Different'},
            ] as const).map(p=>(
              <div className="score-badge-card" key={p.id}>
                <div className="netr-ring">
                  <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="#1A1A28" strokeWidth="3"/><circle cx="28" cy="28" r="24" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" strokeDasharray="150.8" strokeDashoffset="150.8" id={`arc${p.id}`} style={{filter:`drop-shadow(0 0 4px ${p.color})`}}/></svg>
                  <div className="netr-ring-num" style={{color:p.color}} id={`score${p.id}`}>0.0</div>
                  <div className="netr-ring-lbl" style={{color:p.color}}>NETR</div>
                </div>
                <div>
                  <div className="badge-info-name">{p.name}</div>
                  <div className="badge-info-meta">{p.meta}</div>
                  <div className="badge-tier" style={{background:`${p.color}20`,color:p.color,border:`1px solid ${p.color}40`}}>{p.tier}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div id="stats">
        <div className="stats-inner">
          <div className="stat-item reveal"><div className="stat-num"><span className="ctr" data-t="1000">0</span>+</div><div className="stat-label">Courts on NETR</div></div>
          <div className="stat-item reveal" style={{transitionDelay:'.1s'}}><div className="stat-num"><span className="ctr" data-t="7">0</span></div><div className="stat-label">Skill Categories</div></div>
          <div className="stat-item reveal" style={{transitionDelay:'.2s'}}><div className="stat-num"><span className="ctr" data-t="5">0</span>+</div><div className="stat-label">Reviews to Verify</div></div>
          <div className="stat-item reveal" style={{transitionDelay:'.3s'}}><div className="stat-num">0%</div><div className="stat-label">You Can&apos;t Rate Yourself</div></div>
        </div>
      </div>

      <div className="court-divider" />

      <section id="how">
        <div className="section">
          <div className="section-head">
            <span className="label-tag reveal">How It Works</span>
            <h2 className="section-title reveal">Run. Rate. Rep.</h2>
            <p className="section-sub reveal">Your score starts the moment you&apos;re honest with yourself. Then the court takes over.</p>
          </div>
          <div className="steps-wrap">
            <div className="steps-line" /><div className="steps-line-glow" id="stepLine" />
            <div className="steps-grid">
              <div className="step-card featured reveal">
                <div className="step-icon-wrap">🎯</div><div className="step-num">Step 01 · Start Here</div>
                <div className="step-name">Set Your Baseline</div>
                <p className="step-desc">Answer 15 honest questions about your game before your first run. Pure self-awareness gets you on the board.</p>
                <div className="step-note">Self-assessment counts at 28% weight and fades as peer reviews build. You can&apos;t inflate yourself.</div>
              </div>
              <div className="step-card reveal" style={{transitionDelay:'.1s'}}>
                <div className="step-icon-wrap">🏀</div><div className="step-num">Step 02</div>
                <div className="step-name">Find a Run</div>
                <p className="step-desc">Open NETR and see active games at courts near you. Join by QR code or 6-digit join code. Up to 10 players per game.</p>
                <div className="step-note">New: Use Make Teams to auto-split players into balanced 2v2–5v5 teams before tip-off.</div>
              </div>
              <div className="step-card reveal" style={{transitionDelay:'.2s'}}>
                <div className="step-icon-wrap">⭐</div><div className="step-num">Step 03</div>
                <div className="step-name">Rate Teammates</div>
                <p className="step-desc">After the game, rate every player across 7 skill categories: Shooting, Defense, Handles, Playmaking, Rebounding, Basketball IQ, and Finishing.</p>
              </div>
              <div className="step-card reveal" style={{transitionDelay:'.3s'}}>
                <div className="step-icon-wrap">📈</div><div className="step-num">Step 04</div>
                <div className="step-name">Score Evolves</div>
                <p className="step-desc">Peer reviews replace your self-assessment game by game. The more you run, the more accurate and credible your NETR score becomes.</p>
                <div className="step-note">Outlier detection prevents anyone from tanking your score.</div>
              </div>
            </div>
            <div className="callout-bar reveal" style={{transitionDelay:'.1s'}}>
              <div style={{fontSize:'30px',flexShrink:0}}>💡</div>
              <div>
                <div className="callout-text-head">Your self-assessment gets you on the board. Peer reviews make it real.</div>
                <div className="callout-text-sub">You&apos;re never stuck at zero — but the court is the only thing that builds a real NETR score.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="court-divider" />

      <section id="scale">
        <div className="section">
          <div className="section-head">
            <span className="label-tag reveal">The Scale</span>
            <h2 className="section-title reveal">Know Where You Stand</h2>
            <p className="section-sub reveal">9 tiers. Scale runs 2.0–9.9. Every point earned through peer ratings — never self-rated.</p>
          </div>
          <div className="tier-list">
            {[
              {range:'9.5–9.9',name:'In The League',color:'#C40010',w:'100%',bg:'linear-gradient(90deg,#C40010,#FF1A2E)'},
              {range:'9.0–9.4',name:'Certified',color:'#FF3B30',w:'93%',bg:'linear-gradient(90deg,#FF3B30,#FF6B5F)'},
              {range:'8.0–8.9',name:'Elite',color:'#FF7A00',w:'85%',bg:'linear-gradient(90deg,#FF7A00,#FFA040)'},
              {range:'7.0–7.9',name:'Built Different',color:'#FFC247',w:'74%',bg:'linear-gradient(90deg,#FFC247,#FFD47A)'},
              {range:'6.0–6.9',name:'Hooper',color:'#39FF14',w:'63%',bg:'linear-gradient(90deg,#39FF14,#70FF50)'},
              {range:'5.0–5.9',name:'Got Game',color:'#2ECC71',w:'52%',bg:'linear-gradient(90deg,#2ECC71,#52E090)'},
              {range:'4.0–4.9',name:'Prospect',color:'#2DA8FF',w:'42%',bg:'linear-gradient(90deg,#2DA8FF,#60C0FF)'},
              {range:'3.0–3.9',name:'On The Come Up',color:'#7B9FFF',w:'30%',bg:'linear-gradient(90deg,#7B9FFF,#95C2FF)',avg:true},
              {range:'2.0–2.9',name:'Fresh Laces',color:'#9B8BFF',w:'18%',bg:'linear-gradient(90deg,#9B8BFF,#B8ABFF)'},
            ].map((t,i)=>(
              <div className="tier-row reveal" key={t.name} style={{transitionDelay:`${i*.05}s`} as React.CSSProperties}>
                <div style={{position:'absolute',left:0,top:0,bottom:0,width:'3px',background:t.color,borderRadius:'99px 0 0 99px'}}/>
                <div className="tier-range" style={{color:t.color}}>{t.range}</div>
                <div className="tier-info">
                  <div className="tier-name" style={{color:t.color}}>{t.name}</div>
                  {t.avg && <div className="avg-badge"><span className="avg-dot"/>Avg Player</div>}
                </div>
                <div className="tier-bar"><div className="tier-fill" style={{'--w':t.w,background:t.bg} as React.CSSProperties}/></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="court-divider" />

      <section id="vibe">
        <div className="section">
          <div className="section-head">
            <span className="label-tag reveal">Beyond Skill</span>
            <h2 className="section-title reveal">Your Vibe Score</h2>
            <p className="section-sub reveal">NETR tracks more than buckets. How you show up matters — and your teammates will tell you exactly what the vibe was.</p>
          </div>
          <div className="vibe-grid">
            {[
              {score:'4.5+',label:'Great Vibe',desc:'🔥 Locked In. Competitive energy. No drama. Full send every run.',color:'#39FF14',delay:0},
              {score:'3.5–4.4',label:'Solid Vibe',desc:'👍 Steady. Good teammate. Consistent. Easy to run with.',color:'#F5C542',delay:.1},
              {score:'2.5–3.4',label:'Mixed Vibe',desc:"😐 It's Whatever. Some days good, some days the smoke ain't it.",color:'#FF9500',delay:.2},
              {score:'1.0–2.4',label:'Bad Vibe',desc:"🚫 Wouldn't Run Again. Ball hog, arguing calls, or just bad energy.",color:'#FF453A',delay:.3},
            ].map(v=>(
              <div className="vibe-card reveal" key={v.label} style={{borderColor:`${v.color}33`,transitionDelay:`${v.delay}s`} as React.CSSProperties}>
                <div className="vibe-aura" style={{background:v.color,boxShadow:`0 0 14px ${v.color}`,animationDelay:`${v.delay*5}s`}}/>
                <div className="vibe-score" style={{color:v.color}}>{v.score}</div>
                <div className="vibe-label" style={{color:v.color}}>{v.label}</div>
                <div className="vibe-desc">{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="court-divider" />

      <section id="crews">
        <div className="section">
          <div className="section-head">
            <span className="label-tag reveal">New Feature</span>
            <h2 className="section-title reveal">Run With Your Crew.</h2>
            <p className="section-sub reveal">Create or join a crew. Track your squad&apos;s collective NETR score, climb the leaderboard together, and stay locked in with group chat.</p>
          </div>
          <div className="crews-grid reveal">
            {[
              {icon:'🏆',name:'Crew Leaderboard',desc:'Every crew member\'s NETR score stacks. See how your crew ranks against everyone else on the app.'},
              {icon:'💬',name:'Crew Chat',desc:'Built-in group chat for your crew. Coordinate runs, talk trash, plan sessions — all in one place.'},
              {icon:'🔍',name:'Find & Join',desc:'Search for existing crews or create your own. Invite your guys by name — no long codes.'},
              {icon:'🏅',name:'Crew Identity',desc:'Your crew has its own name, profile, and rep. Build something real with the people you run with.'},
            ].map((c,i)=>(
              <div className="crew-card reveal" key={c.name} style={{transitionDelay:`${i*.08}s`}}>
                <div className="crew-icon-wrap">{c.icon}</div>
                <div className="crew-name">{c.name}</div>
                <div className="crew-desc">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="court-divider" />

      <section id="rep">
        <div className="section">
          <div className="section-head">
            <span className="label-tag reveal">Earn XP</span>
            <h2 className="section-title reveal">Court Rep</h2>
            <p className="section-sub reveal">Show up. Rate players. Host games. Level up from Newcomer to Legend.</p>
          </div>
          <div className="rep-grid">
            {[
              {icon:'🏀',name:'First Run',desc:'Join your first game session on NETR',delay:0},
              {icon:'⭐',name:'Rater',desc:'Rate 10+ players after games',delay:.08},
              {icon:'🗺️',name:'Court Hopper',desc:'Check in at 5 different courts',delay:.16},
              {icon:'📍',name:'Regular',desc:'10+ runs at the same court',delay:.08},
              {icon:'🎯',name:'On Sight',desc:'NETR score hits 6.0+ for the first time',delay:.16},
              {icon:'👑',name:'Legend',desc:'Reach Level 5 — 500 XP earned',delay:.24},
            ].map(r=>(
              <div className="rep-card reveal" key={r.name} style={{transitionDelay:`${r.delay}s`}}>
                <div className="rep-icon-wrap">{r.icon}</div>
                <div><div className="rep-name">{r.name}</div><div className="rep-desc">{r.desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="waitlist">
        <canvas id="waitlist-canvas"/>
        <div className="waitlist-inner">
          <span className="label-tag reveal" style={{justifyContent:'center',display:'block'}}>NYC Beta · iOS</span>
          <h2 className="waitlist-title reveal">Get Your<br/><span>NETR Score.</span></h2>
          <p className="waitlist-sub reveal">Join the beta. NYC courts already loaded. Your first game is waiting.</p>
          <form className="waitlist-form reveal" onSubmit={submitWait}>
            <input className="waitlist-input" type="email" placeholder="your@email.com" required/>
            <button className="btn-primary" type="submit">Join Waitlist</button>
          </form>
          <div className="success-msg" id="success">✓ You&apos;re on the list. See you on the court.</div>
          <p className="waitlist-note reveal">No spam. No clout. Just the drop when it&apos;s ready.</p>
        </div>
      </section>

      <footer>
        <div className="footer-logo">NETR</div>
        <div className="footer-links">
          <a href="#how">How It Works</a>
          <a href="#scale">Rating Scale</a>
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="https://instagram.com/netrapp" target="_blank" rel="noopener noreferrer">Instagram</a>
        </div>
        <p className="footer-copy">© 2026 NETR. NYC-first. Built for ballers.</p>
      </footer>
    </>
  )
}
