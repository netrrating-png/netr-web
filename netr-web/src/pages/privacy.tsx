import Head from 'next/head'
import { useEffect } from 'react'

const TESTFLIGHT_URL = process.env.NEXT_PUBLIC_TESTFLIGHT_URL || 'https://testflight.apple.com/join/REPLACE_ME'

const sections = [
  {
    title: 'Information We Collect',
    content: [
      {
        subtitle: 'Account Information',
        text: 'When you create a NETR account we collect your name, email address, username, and optional profile details such as height, position, and location (city/neighborhood). We never require your exact address.',
      },
      {
        subtitle: 'Gameplay & Rating Data',
        text: 'We collect the ratings you give and receive, game session details (court location, date, participants), and skill-category scores across the seven NETR categories. This data is what powers your NETR score.',
      },
      {
        subtitle: 'Device & Usage Information',
        text: 'We collect standard device identifiers, operating-system version, IP address, crash reports, and in-app usage events to keep the app running smoothly and to understand how features are used.',
      },
      {
        subtitle: 'Location Data',
        text: 'The app requests approximate location (city-level) to show nearby courts and active games. Precise GPS is only used when you actively host or join a game session. You can revoke location permissions in your device settings at any time.',
      },
    ],
  },
  {
    title: 'How We Use Your Information',
    content: [
      {
        subtitle: 'Core Product Functionality',
        text: 'We use your data to calculate and display your NETR score, facilitate game sessions, power the Make Teams balancing feature, operate Crew group chats, and deliver Daily Games challenges.',
      },
      {
        subtitle: 'Communications',
        text: 'We may send you transactional emails (password resets, account alerts) and, with your consent, product updates and community announcements. You can opt out of marketing communications at any time.',
      },
      {
        subtitle: 'Safety & Trust',
        text: 'We use outlier-detection models and moderation signals to protect the integrity of ratings, prevent gaming of the system, and respond to reports of abusive behavior.',
      },
      {
        subtitle: 'Analytics & Improvement',
        text: 'Aggregated, de-identified usage data helps us understand what features resonate, diagnose bugs, and prioritize what to build next. We do not sell individual-level data for advertising.',
      },
    ],
  },
  {
    title: 'Sharing Your Information',
    content: [
      {
        subtitle: 'Other Users',
        text: 'Your NETR score, skill-category breakdown, vibe score, username, and profile photo are visible to other users by default. Ratings you give after a game are anonymized — recipients see aggregated feedback, not who said what.',
      },
      {
        subtitle: 'Service Providers',
        text: 'We share data with carefully vetted third-party vendors (cloud hosting, analytics, push notifications, customer support tooling) who process data only on our behalf and under strict confidentiality obligations.',
      },
      {
        subtitle: 'Legal Requirements',
        text: 'We may disclose information if required by law, court order, or governmental authority, or when we believe disclosure is necessary to protect the rights or safety of NETR, our users, or the public.',
      },
      {
        subtitle: 'Business Transfers',
        text: 'If NETR is acquired, merged, or undergoes a similar transaction, your information may transfer to the successor entity. We will notify you via email or in-app notice before that happens.',
      },
    ],
  },
  {
    title: 'Data Retention',
    content: [
      {
        subtitle: 'Active Accounts',
        text: 'We retain your information for as long as your account is active. Game session and rating data is kept to maintain the integrity of the scoring system over time.',
      },
      {
        subtitle: 'Account Deletion',
        text: 'You can delete your account at any time from Settings → Account → Delete Account. We will remove your personal data within 30 days, except where retention is required by law or to prevent fraud. Aggregated, de-identified statistics derived from your ratings may remain.',
      },
    ],
  },
  {
    title: 'Your Privacy Rights',
    content: [
      {
        subtitle: 'Access & Portability',
        text: 'You can request a copy of the personal data we hold about you, including your rating history, at any time by emailing netrrating@gmail.com.',
      },
      {
        subtitle: 'Correction',
        text: 'You can update most of your profile information directly in the app. For data you cannot edit yourself, contact us and we will correct inaccuracies.',
      },
      {
        subtitle: 'Deletion',
        text: 'You have the right to request deletion of your personal data as described in the Data Retention section above.',
      },
      {
        subtitle: 'Opt-Out of Marketing',
        text: 'Use the unsubscribe link in any marketing email or toggle notifications off in Settings. Opting out of marketing will not affect transactional messages needed to operate your account.',
      },
      {
        subtitle: 'California Residents (CCPA/CPRA)',
        text: 'California residents have the right to know what personal information we collect, to request deletion, to opt out of the sale of personal information (we do not sell personal information), and to non-discrimination for exercising these rights.',
      },
    ],
  },
  {
    title: 'Security',
    content: [
      {
        subtitle: '',
        text: 'We use industry-standard security measures including encryption in transit (TLS) and at rest, access controls, and regular security reviews. No system is 100% secure. If you discover a security vulnerability, please contact us at netrrating@gmail.com.',
      },
    ],
  },
  {
    title: "Children's Privacy",
    content: [
      {
        subtitle: '',
        text: 'NETR is not directed at children under 13. We do not knowingly collect personal information from anyone under 13. If we learn we have inadvertently collected such data, we will delete it promptly. Parents or guardians who believe their child has created an account should contact us at netrrating@gmail.com.',
      },
    ],
  },
  {
    title: 'Changes to This Policy',
    content: [
      {
        subtitle: '',
        text: 'We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date at the top of this page and, for material changes, notify you via email or in-app alert at least 14 days before the change takes effect. Continued use of NETR after the effective date constitutes acceptance of the updated policy.',
      },
    ],
  },
  {
    title: 'Contact Us',
    content: [
      {
        subtitle: '',
        text: 'Questions, concerns, or requests related to this Privacy Policy can be sent to netrrating@gmail.com. We aim to respond within 30 days.',
      },
    ],
  },
]

export default function Privacy() {
  useEffect(() => {
    const nav = document.getElementById('privacy-nav') as HTMLElement
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })

    const cur = document.getElementById('cursor') as HTMLElement
    const trail = document.getElementById('cursor-trail') as HTMLElement
    let mx = 0, my = 0, tx = 0, ty = 0, rafT: number
    const onMove = (e: MouseEvent) => { mx = e.clientX; my = e.clientY; cur.style.left = mx + 'px'; cur.style.top = my + 'px' }
    document.addEventListener('mousemove', onMove)
    const animTrail = () => { tx += (mx - tx) * .14; ty += (my - ty) * .14; trail.style.left = tx + 'px'; trail.style.top = ty + 'px'; rafT = requestAnimationFrame(animTrail) }
    rafT = requestAnimationFrame(animTrail)

    return () => { window.removeEventListener('scroll', onScroll); document.removeEventListener('mousemove', onMove); cancelAnimationFrame(rafT) }
  }, [])

  return (
    <>
      <Head>
        <title>Privacy Policy — NETR</title>
        <meta name="description" content="NETR Privacy Policy — how we collect, use, and protect your data." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#040406;--surface:#08080D;--card:#0D0D14;--border:#1A1A28;--accent:#39FF14;--text:#EEEEF5;--sub:#5A5A78;--muted:#222232;}
        html{scroll-behavior:smooth}
        body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;overflow-x:hidden;}
        @media(hover:hover){body{cursor:none}}
        #cursor{position:fixed;width:20px;height:20px;border-radius:50%;background:var(--accent);pointer-events:none;z-index:9999;transform:translate(-50%,-50%);box-shadow:0 0 12px var(--accent),0 0 30px #39FF1466;transition:width .15s,height .15s,background .15s;mix-blend-mode:screen;}
        #cursor-trail{position:fixed;width:40px;height:40px;border-radius:50%;border:1px solid #39FF1455;pointer-events:none;z-index:9998;transform:translate(-50%,-50%);}
        body:has(a:hover) #cursor,body:has(button:hover) #cursor{width:36px;height:36px;background:#fff;}
        @media(hover:none){#cursor,#cursor-trail{display:none}}
        #privacy-nav{position:fixed;top:0;left:0;right:0;z-index:500;padding:0 48px;height:64px;display:flex;align-items:center;justify-content:space-between;transition:background .3s,border-color .3s;border-bottom:1px solid transparent;}
        #privacy-nav.scrolled{background:rgba(4,4,6,.92);backdrop-filter:blur(24px);border-bottom-color:var(--border);}
        .nav-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:30px;color:var(--accent);text-shadow:0 0 16px #39FF1499;letter-spacing:.02em;text-decoration:none;}
        .nav-links{display:flex;align-items:center;gap:22px}
        .nav-links a{font-size:11px;font-weight:600;color:var(--sub);letter-spacing:.08em;text-transform:uppercase;transition:color .2s;text-decoration:none;}
        .nav-links a:hover{color:var(--text)}
        .btn-cta{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:14px;letter-spacing:.1em;text-transform:uppercase;padding:10px 24px;border-radius:8px;border:none;cursor:pointer;background:linear-gradient(135deg,#39FF14,#00CC22);color:#040406;transition:box-shadow .25s,transform .2s;}
        .btn-cta:hover{box-shadow:0 0 28px #39FF1488,0 6px 24px #39FF1444;transform:translateY(-2px);}
        @media(max-width:640px){#privacy-nav{padding:0 20px}.nav-links a{display:none}}
        .privacy-hero{padding:140px 48px 60px;text-align:center;max-width:800px;margin:0 auto;}
        .privacy-eyebrow{display:inline-flex;align-items:center;gap:8px;background:#39FF1410;border:1px solid #39FF1430;border-radius:99px;padding:6px 16px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:28px;}
        .privacy-title{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:clamp(56px,9vw,100px);line-height:.92;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:20px;}
        .privacy-title span{background:linear-gradient(90deg,var(--accent),#00FF88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 24px #39FF1466);}
        .privacy-sub{font-size:17px;color:var(--sub);line-height:1.7;}
        .privacy-updated{font-size:12px;color:var(--muted);margin-top:12px;letter-spacing:.04em;}
        .privacy-body{max-width:800px;margin:0 auto;padding:20px 48px 120px;}
        @media(max-width:640px){.privacy-hero{padding:120px 20px 40px}.privacy-body{padding:20px 20px 80px}}
        .privacy-section{border:1px solid var(--border);border-radius:14px;background:var(--card);margin-bottom:12px;overflow:hidden;}
        .privacy-section-title{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:20px;color:var(--text);padding:22px 24px 0;letter-spacing:.01em;}
        .privacy-section-body{padding:14px 24px 22px;display:flex;flex-direction:column;gap:14px;}
        .privacy-item-subtitle{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin-bottom:4px;}
        .privacy-item-text{font-size:14px;color:var(--sub);line-height:1.75;}
        .privacy-contact-link{color:var(--accent);text-decoration:none;border-bottom:1px solid #39FF1444;transition:border-color .2s;}
        .privacy-contact-link:hover{border-color:var(--accent);}
        footer{background:var(--surface);border-top:1px solid var(--border);padding:40px 48px;text-align:center;}
        .footer-logo{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:26px;color:var(--accent);text-shadow:0 0 12px #39FF1477;margin-bottom:16px;}
        .footer-links{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
        .footer-links a{font-size:12px;color:var(--sub);letter-spacing:.05em;transition:color .2s;text-decoration:none;}
        .footer-links a:hover{color:var(--text)}
        .footer-copy{font-size:11px;color:var(--muted)}
      `}</style>

      <div id="cursor" />
      <div id="cursor-trail" />

      <nav id="privacy-nav">
        <a href="/" className="nav-logo">NETR</a>
        <div className="nav-links">
          <a href="/#how">How It Works</a>
          <a href="/#scale">Rating Scale</a>
          <a href="/#vibe">Vibe Score</a>
          <a href="/#crews">Crews</a>
          <a href="/faq">FAQ</a>
          <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer"><button className="btn-cta">Get the App</button></a>
        </div>
      </nav>

      <div className="privacy-hero">
        <div className="privacy-eyebrow">Your Data, Your Rights</div>
        <h1 className="privacy-title">Privacy<br /><span>Policy.</span></h1>
        <p className="privacy-sub">We keep it straight: what we collect, why, and how you stay in control.</p>
        <p className="privacy-updated">Last updated: April 19, 2026</p>
      </div>

      <div className="privacy-body">
        {sections.map(section => (
          <div className="privacy-section" key={section.title}>
            <h2 className="privacy-section-title">{section.title}</h2>
            <div className="privacy-section-body">
              {section.content.map((item, i) => (
                <div key={i}>
                  {item.subtitle && <div className="privacy-item-subtitle">{item.subtitle}</div>}
                  <p
                    className="privacy-item-text"
                    dangerouslySetInnerHTML={{
                      __html: item.text.replace(
                        /(netrrating@gmail\.com)/g,
                        '<a href="mailto:$1" class="privacy-contact-link">$1</a>'
                      ),
                    }}
                  />
                </div>
              ))}
            </div>
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
