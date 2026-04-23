import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'

const CNAME_TARGET = 'leagues.netr.pro'

type Registrar = 'godaddy' | 'namecheap' | 'google'

export default function DomainSetup() {
  const { query } = useRouter()
  const domain = (query.domain as string) || 'yourdomain.com'
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Registrar>('godaddy')

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const steps: Record<Registrar, { name: string; steps: string[] }> = {
    godaddy: {
      name: 'GoDaddy',
      steps: [
        'Sign in to godaddy.com and click your name → My Products',
        'Find your domain and click DNS',
        'Scroll to the Records section and click Add',
        'Set Type to CNAME',
        'Set Host to @ (or leave blank)',
        `Set Points to: ${CNAME_TARGET}`,
        'Set TTL to 1 hour (3600)',
        'Click Save — changes take effect within a few minutes',
      ],
    },
    namecheap: {
      name: 'Namecheap',
      steps: [
        'Sign in to namecheap.com and go to Domain List',
        'Click Manage next to your domain',
        'Click the Advanced DNS tab',
        'Under Host Records, click Add New Record',
        'Set Type to CNAME Record',
        'Set Host to @ (or leave blank)',
        `Set Value to: ${CNAME_TARGET}`,
        'Click the checkmark to save',
      ],
    },
    google: {
      name: 'Google Domains',
      steps: [
        'Sign in to domains.google.com',
        'Click your domain name',
        'Click DNS in the left sidebar',
        'Scroll to Custom Records and click Manage custom records',
        'Click Create new record',
        'Set Type to CNAME',
        'Leave Host Name blank (or use @)',
        `Set Data to: ${CNAME_TARGET}`,
        'Click Save',
      ],
    },
  }

  const active = steps[tab]

  return (
    <>
      <Head>
        <title>Domain Setup — NETR</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ minHeight: '100vh', background: '#040406', color: '#EEEEF5', fontFamily: "'DM Sans',sans-serif", padding: '40px 20px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#39FF14', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>
              NETR League Setup
            </div>
            <h1 style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 900, fontSize: 32, textTransform: 'uppercase', lineHeight: 1.1, marginBottom: 12 }}>
              Point {domain} to your league page
            </h1>
            <p style={{ fontSize: 15, color: '#A0A0B8', lineHeight: 1.6, margin: 0 }}>
              Add one DNS record and your league will be live at your own domain. Takes about 5 minutes.
            </p>
          </div>

          {/* CNAME record box */}
          <div style={{ background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 12, padding: 20, marginBottom: 28 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6A6A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
              DNS Record to Add
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px 16px', marginBottom: 16 }}>
              {[['Type', 'CNAME'], ['Host', '@'], ['Value', CNAME_TARGET], ['TTL', '3600 (1 hour)']].map(([label, value]) => (
                <div key={label} style={{ display: 'contents' }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: '#6A6A82', paddingTop: 2 }}>{label}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#EEEEF5', wordBreak: 'break-all' }}>{value}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => copy(CNAME_TARGET)}
              style={{ background: copied ? '#39FF1422' : '#14141C', border: `1px solid ${copied ? '#39FF14' : '#2E2E3A'}`, borderRadius: 8, color: copied ? '#39FF14' : '#EEEEF5', fontFamily: "'DM Mono',monospace", fontSize: 12, padding: '8px 16px', cursor: 'pointer', width: '100%' }}
            >
              {copied ? '✓ Copied!' : `Copy Value: ${CNAME_TARGET}`}
            </button>
          </div>

          {/* Registrar tabs */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6A6A82', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Step-by-step instructions
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {(['godaddy', 'namecheap', 'google'] as Registrar[]).map(r => (
                <button key={r} onClick={() => setTab(r)} style={{ background: tab === r ? '#39FF1422' : 'transparent', border: `1px solid ${tab === r ? '#39FF14' : '#2E2E3A'}`, borderRadius: 8, color: tab === r ? '#39FF14' : '#6A6A82', fontFamily: "'DM Sans',sans-serif", fontSize: 13, padding: '7px 14px', cursor: 'pointer' }}>
                  {steps[r].name}
                </button>
              ))}
            </div>
            <div style={{ background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 12, padding: 20 }}>
              <ol style={{ margin: 0, padding: '0 0 0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {active.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 14, color: '#C8C8D4', lineHeight: 1.5 }}>{step}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Footer note */}
          <div style={{ marginTop: 28, padding: 16, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#6A6A82', lineHeight: 1.6 }}>
              DNS changes usually take effect within minutes, but can take up to 24 hours. Once done, the commissioner can click "Check Status" in their league settings to confirm everything is live.
            </div>
          </div>

          <div style={{ marginTop: 32, textAlign: 'center', fontSize: 12, color: '#3A3A4E', fontFamily: "'DM Mono',monospace" }}>
            Powered by <a href="https://www.netr.pro" style={{ color: '#39FF14', textDecoration: 'none' }}>NETR</a>
          </div>
        </div>
      </div>
    </>
  )
}
