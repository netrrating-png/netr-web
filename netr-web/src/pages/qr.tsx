import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const APP_URL = 'https://testflight.apple.com/join/REPLACE_ME'

// Campaign configs — add new ones here as you create campaigns
const CAMPAIGNS: Record<string, { label: string; headline: string; sub: string; url: string }> = {
  default: {
    label: 'BETA ACCESS',
    headline: 'Scan to Get\nYour NETR Score',
    sub: 'Join the beta. Rate who you run with.\nBuild your verified rep.',
    url: APP_URL,
  },
  rucker: {
    label: 'RUCKER PARK',
    headline: 'Scan to\nRate Your Run',
    sub: 'You just ran at Rucker. Now rate who you played with\nand get your own verified NETR score.',
    url: APP_URL,
  },
  dyckman: {
    label: 'DYCKMAN PARK',
    headline: 'Scan to\nRate Your Run',
    sub: 'You just ran at Dyckman. Now rate who you played with\nand get your own verified NETR score.',
    url: APP_URL,
  },
  west4: {
    label: 'WEST 4TH',
    headline: 'Scan to\nRate Your Run',
    sub: 'West 4th is on NETR. Rate who you ran with\nand build your verified score.',
    url: APP_URL,
  },
  flyer: {
    label: 'GET THE APP',
    headline: 'Your Rep.\nBuilt on the Court.',
    sub: 'NETR is the first peer-to-peer basketball rating system.\nNo self-rating. Real scores. Real players.',
    url: APP_URL,
  },
  instagram: {
    label: 'JOIN BETA',
    headline: 'RUN.\nRATE.\nREP.',
    sub: 'Get your verified NETR score.\nNow in beta — free to join.',
    url: APP_URL,
  },
}

// Simple QR code using Google Charts API (no package needed)
function QRCode({ url, size = 220 }: { url: string; size?: number }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=040406&margin=10`
  return (
    <div className="qr-box">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrUrl} alt="NETR QR Code" width={size} height={size} style={{ display: 'block', borderRadius: '8px' }} />
    </div>
  )
}

export default function QRPage() {
  const router = useRouter()
  const campaignKey = (router.query.c as string) || 'default'
  const campaign = CAMPAIGNS[campaignKey] || CAMPAIGNS.default

  // Track scan → redirect
  const [scanned, setScanned] = useState(false)

  // If accessed from mobile (likely a scan), auto-redirect after 1.5s
  useEffect(() => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile && router.query.go === '1') {
      setTimeout(() => {
        window.location.href = campaign.url
      }, 800)
    }
  }, [campaign.url, router.query.go])

  const destinationUrl = campaign.url
  const qrTarget = typeof window !== 'undefined'
    ? `${window.location.origin}/qr?c=${campaignKey}&go=1`
    : `/qr?c=${campaignKey}&go=1`

  return (
    <>
      <Head>
        <title>NETR — Get the App</title>
        <meta name="description" content="Join NETR beta. Rate who you run with. Build your rep." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
        {/* Auto-redirect for mobile scans */}
        {router.query.go === '1' && (
          <meta httpEquiv="refresh" content={`1;url=${destinationUrl}`} />
        )}
      </Head>

      <div style={{ minHeight: '100vh', background: '#040406', color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', position: 'relative', overflow: 'hidden' }}>
        {/* Background glow */}
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }} />

        <div style={{ background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: '24px', padding: '48px', maxWidth: '440px', width: '100%', textAlign: 'center', position: 'relative', zIndex: 1, boxShadow: '0 0 60px rgba(57,255,20,0.08)' }}>

          {/* Logo */}
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '48px', color: '#39FF14', textShadow: '0 0 20px rgba(57,255,20,0.5)', marginBottom: '4px', lineHeight: 1 }}>
            NETR
          </div>
          <div style={{ fontSize: '11px', color: '#6A6A82', letterSpacing: '3px', textTransform: 'uppercase', fontFamily: "'DM Mono', monospace", marginBottom: '32px' }}>
            {campaign.label}
          </div>

          {/* QR Code */}
          {router.query.go === '1' ? (
            // Mobile redirect mode — show loading
            <div style={{ padding: '40px 0' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏀</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '24px', color: '#39FF14', marginBottom: '8px' }}>
                Opening App Store...
              </div>
              <div style={{ fontSize: '13px', color: '#6A6A82' }}>Taking you to TestFlight</div>
            </div>
          ) : (
            <QRCode url={qrTarget} size={200} />
          )}

          {/* Headline */}
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '32px', lineHeight: 1.05, color: '#EEEEF5', marginBottom: '12px', whiteSpace: 'pre-line' }}>
            {campaign.headline}
          </div>

          {/* Sub */}
          <p style={{ fontSize: '14px', color: '#6A6A82', lineHeight: 1.65, marginBottom: '28px', whiteSpace: 'pre-line' }}>
            {campaign.sub}
          </p>

          {/* CTA Button (for desktop viewers of the QR page) */}
          <a
            href={destinationUrl}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
              color: '#040406', fontWeight: 700, fontSize: '16px',
              padding: '16px 24px', borderRadius: '14px', textDecoration: 'none',
              boxShadow: '0 8px 32px rgba(57,255,20,0.3)',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'transform 0.2s ease',
              marginBottom: '16px',
            }}
          >
            📲 Download on TestFlight
          </a>

          <div style={{ fontSize: '12px', color: '#6A6A82', marginBottom: '32px' }}>
            Free · iOS only · Beta access
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', paddingTop: '24px', borderTop: '1px solid #1C1C26' }}>
            {[
              { num: '584+', label: 'NYC Courts' },
              { num: '7', label: 'Skill Cats' },
              { num: '0%', label: 'Self-Rating' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '26px', color: '#39FF14', textShadow: '0 0 10px rgba(57,255,20,0.4)' }}>{s.num}</div>
                <div style={{ fontSize: '11px', color: '#6A6A82', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Campaign selector for team — only visible in dev or with ?debug=1 */}
        {(router.query.debug === '1') && (
          <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: '12px', padding: '12px 16px', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', zIndex: 10 }}>
            <div style={{ fontSize: '11px', color: '#6A6A82', width: '100%', textAlign: 'center', marginBottom: '4px', fontFamily: 'monospace' }}>QR CAMPAIGNS</div>
            {Object.keys(CAMPAIGNS).map(key => (
              <button
                key={key}
                onClick={() => router.push(`/qr?c=${key}`)}
                style={{
                  background: key === campaignKey ? '#39FF14' : '#1C1C26',
                  color: key === campaignKey ? '#040406' : '#6A6A82',
                  border: 'none', borderRadius: '6px', padding: '4px 10px',
                  fontSize: '11px', fontFamily: 'monospace', cursor: 'pointer',
                  textTransform: 'uppercase', letterSpacing: '1px',
                }}
              >
                {key}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
