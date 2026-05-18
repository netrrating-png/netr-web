import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { supabase, League, LeagueDivision } from '../../../lib/supabase'
import { PortalNav } from './index'

type Standing = {
  team_id: string
  team_name: string
  color: string
  wins: number
  losses: number
  pts_for: number
  pts_against: number
  division_id: string | null
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b]
}

function generateStandingsImage(
  standings: Standing[],
  leagueName: string,
  season: string | null,
  accentHex: string
): string {
  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const accent = accentHex || '#39FF14'
  const [ar, ag, ab] = hexToRgb(accent)

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#07070F')
  bg.addColorStop(1, '#020206')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Accent top bar
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, 10)

  // Subtle grid lines
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.04)`
  ctx.lineWidth = 1
  for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }

  // League name
  ctx.fillStyle = accent
  ctx.font = '900 80px Impact, "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.letterSpacing = '2px'
  const nameText = leagueName.toUpperCase()
  // Clamp font size if name is long
  const maxNameWidth = W - 120
  let nameFontSize = 80
  ctx.font = `900 ${nameFontSize}px Impact, "Barlow Condensed", sans-serif`
  while (ctx.measureText(nameText).width > maxNameWidth && nameFontSize > 36) {
    nameFontSize -= 4
    ctx.font = `900 ${nameFontSize}px Impact, "Barlow Condensed", sans-serif`
  }
  ctx.fillText(nameText, W / 2, 120)

  // Season + STANDINGS label
  ctx.fillStyle = `rgba(255,255,255,0.35)`
  ctx.font = '400 26px "DM Mono", "Courier New", monospace'
  ctx.fillText((season ? `${season} · ` : '') + 'STANDINGS', W / 2, 162)

  // Divider
  ctx.strokeStyle = `rgba(${ar},${ag},${ab},0.25)`
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(60, 185); ctx.lineTo(W - 60, 185); ctx.stroke()

  // Table headers
  const rowH = Math.min(72, Math.floor((H - 260) / Math.max(standings.length, 1)))
  const tableTop = 210
  const cols = { rank: 80, name: 340, w: 480, l: 560, pct: 660, pf: 760, diff: 860 }

  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '400 18px "DM Mono", "Courier New", monospace'
  ctx.textAlign = 'center'
  ;[['#', cols.rank], ['TEAM', cols.name + 100], ['W', cols.w], ['L', cols.l], ['PCT', cols.pct], ['PF', cols.pf], ['DIFF', cols.diff]].forEach(([label, x]) => {
    if (label === 'TEAM') {
      ctx.textAlign = 'left'
      ctx.fillText(label as string, cols.name, tableTop)
      ctx.textAlign = 'center'
    } else {
      ctx.fillText(label as string, x as number, tableTop)
    }
  })

  // Rows
  standings.slice(0, 10).forEach((s, i) => {
    const y = tableTop + 30 + i * rowH
    const gp = s.wins + s.losses
    const pct = gp > 0 ? (s.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
    const diff = s.pts_for - s.pts_against
    const isFirst = i === 0 && s.wins > 0

    // Row background
    if (isFirst) {
      ctx.fillStyle = `rgba(${ar},${ag},${ab},0.08)`
      ctx.beginPath()
      ;(ctx as CanvasRenderingContext2D & { roundRect?: (x:number,y:number,w:number,h:number,r:number)=>void }).roundRect?.(60, y - rowH + 12, W - 120, rowH - 4, 8) ?? ctx.rect(60, y - rowH + 12, W - 120, rowH - 4)
      ctx.fill()
    }

    // Rank
    ctx.textAlign = 'center'
    if (isFirst) {
      ctx.font = `bold ${Math.min(28, rowH - 8)}px sans-serif`
      ctx.fillStyle = accent
      ctx.fillText('🏆', cols.rank, y)
    } else {
      ctx.font = `400 ${Math.min(22, rowH - 14)}px "DM Mono", monospace`
      ctx.fillStyle = 'rgba(255,255,255,0.3)'
      ctx.fillText(String(i + 1), cols.rank, y)
    }

    // Team color dot
    ctx.beginPath()
    ctx.arc(cols.name - 18, y - 6, 7, 0, Math.PI * 2)
    ctx.fillStyle = s.color || '#6A6A82'
    ctx.fill()

    // Team name
    ctx.textAlign = 'left'
    ctx.font = `700 ${Math.min(26, rowH - 10)}px Impact, "Barlow Condensed", sans-serif`
    ctx.fillStyle = isFirst ? '#FFFFFF' : 'rgba(255,255,255,0.75)'
    const maxTeamW = 240
    let teamName = s.team_name.toUpperCase()
    while (ctx.measureText(teamName).width > maxTeamW && teamName.length > 4) teamName = teamName.slice(0, -1) + '…'
    ctx.fillText(teamName, cols.name, y)

    // Stats
    ctx.textAlign = 'center'
    ctx.font = `600 ${Math.min(24, rowH - 12)}px Impact, "Barlow Condensed", sans-serif`
    ctx.fillStyle = accent
    ctx.fillText(String(s.wins), cols.w, y)

    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.fillText(String(s.losses), cols.l, y)

    ctx.font = `400 ${Math.min(20, rowH - 14)}px "DM Mono", monospace`
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.fillText(pct, cols.pct, y)
    ctx.fillText(String(s.pts_for), cols.pf, y)

    ctx.fillStyle = diff > 0 ? accent : diff < 0 ? '#FF453A' : 'rgba(255,255,255,0.3)'
    ctx.fillText((diff > 0 ? '+' : '') + diff, cols.diff, y)

    // Row separator
    if (i < standings.length - 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(80, y + 10)
      ctx.lineTo(W - 80, y + 10)
      ctx.stroke()
    }
  })

  // Bottom branding
  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.6)`
  ctx.font = '700 22px Impact, "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('NETR LEAGUES', W / 2, H - 32)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '400 16px "DM Mono", monospace'
  ctx.fillText('netrrating.com', W / 2, H - 12)

  return canvas.toDataURL('image/jpeg', 0.95)
}

export default function StandingsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [standings, setStandings] = useState<Standing[]>([])
  const [divisions, setDivisions] = useState<LeagueDivision[]>([])
  const [divFilter, setDivFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareImgUrl, setShareImgUrl] = useState<string | null>(null)
  const [generatingImg, setGeneratingImg] = useState(false)
  const shareCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, standingsRes, divisionsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_standings').select('*').eq('league_id', leagueId),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)
      setStandings(standingsRes.data ?? [])
      const divs = divisionsRes.data ?? []
      setDivisions(divs)
      if (!(leagueRes.data.cross_division_play ?? true) && divs.length > 0) {
        setDivFilter(divs[0].id)
      }
      setLoading(false)
    })
  }, [leagueId])

  function openShareModal() {
    setShowShareModal(true)
    setShareImgUrl(null)
    setGeneratingImg(true)
    setTimeout(() => {
      try {
        const imgUrl = generateStandingsImage(
          visibleStandings,
          league!.name,
          league!.season,
          league!.accent_color || '#39FF14'
        )
        setShareImgUrl(imgUrl)
      } catch (e) {
        console.error('Image generation failed', e)
      }
      setGeneratingImg(false)
    }, 50)
  }

  function downloadImage() {
    if (!shareImgUrl) return
    const a = document.createElement('a')
    a.href = shareImgUrl
    a.download = `${league?.name ?? 'standings'}-standings.jpg`
    a.click()
  }

  function downloadCsv() {
    const rows = [['Rank', 'Team', 'W', 'L', 'PCT', 'PF', 'PA', 'DIFF']]
    visibleStandings.forEach((s, i) => {
      const gp = s.wins + s.losses
      const pct = gp > 0 ? (s.wins / gp).toFixed(3) : '.000'
      const diff = s.pts_for - s.pts_against
      rows.push([String(i + 1), s.team_name, String(s.wins), String(s.losses), pct, String(s.pts_for), String(s.pts_against), (diff > 0 ? '+' : '') + diff])
    })
    const csv = rows.map(r => r.join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `${league?.name ?? 'standings'}-standings.csv`
    a.click()
  }

  if (loading || !league) return <LoadingScreen />

  const visibleStandings = divFilter === 'all' ? standings : standings.filter(s => s.division_id === divFilter)
  const totalGames = visibleStandings.reduce((n, s) => n + s.wins + s.losses, 0) / 2
  const accent = league.accent_color || '#39FF14'

  return (
    <>
      <Head>
        <title>Standings — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="standings" />

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Standings</h1>
              <p style={S.sub}>
                {visibleStandings.length} team{visibleStandings.length !== 1 ? 's' : ''} · {totalGames} game{totalGames !== 1 ? 's' : ''} played
              </p>
            </div>
            {visibleStandings.length > 0 && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={downloadCsv} style={S.exportBtn}>⬇ CSV</button>
                <button onClick={openShareModal} style={{ ...S.exportBtn, background: `${accent}18`, borderColor: `${accent}55`, color: accent }}>
                  📤 Share Image
                </button>
              </div>
            )}
          </div>

          {/* Division filter tabs */}
          {divisions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {[(league.cross_division_play ?? true) ? { id: 'all', name: 'All' } : null, ...divisions].filter(Boolean).map(d => (
                <button
                  key={d!.id}
                  onClick={() => setDivFilter(d!.id)}
                  style={{
                    background: divFilter === d!.id ? `${accent}18` : '#0F0F14',
                    border: `1.5px solid ${divFilter === d!.id ? accent : '#1C1C26'}`,
                    borderRadius: 8,
                    color: divFilter === d!.id ? accent : '#6A6A82',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: 1,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {d!.name}
                </button>
              ))}
            </div>
          )}

          {visibleStandings.length === 0 ? (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🏆</div>
              <p style={S.emptyText}>No games played yet. Standings will appear once you enter your first score.</p>
              <a href={`/league-portal/${leagueId}/schedule`} style={{ ...S.emptyLink, color: accent }}>Go to Schedule →</a>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width: 40 }}>#</th>
                    <th style={{ ...S.th, textAlign: 'left' as const }}>Team</th>
                    <th style={S.th}>W</th>
                    <th style={S.th}>L</th>
                    <th style={S.th}>PCT</th>
                    <th style={S.th}>PF</th>
                    <th style={S.th}>PA</th>
                    <th style={S.th}>DIFF</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStandings.map((s, i) => {
                    const gp = s.wins + s.losses
                    const pct = gp > 0 ? (s.wins / gp).toFixed(3).replace(/^0/, '') : '.000'
                    const diff = s.pts_for - s.pts_against
                    const isFirst = i === 0 && s.wins > 0

                    return (
                      <tr key={s.team_id} style={{ ...S.tr, background: isFirst ? `${accent}08` : 'transparent' }}>
                        <td style={{ ...S.td, textAlign: 'center' as const, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                          {i === 0 && s.wins > 0 ? '🏆' : i + 1}
                        </td>
                        <td style={S.td}>
                          <div style={S.teamCell}>
                            <div style={{ ...S.teamDot, background: s.color, boxShadow: `0 0 6px ${s.color}66` }} />
                            <span style={{ ...S.teamName, color: isFirst ? '#EEEEF5' : '#C8C8D4' }}>{s.team_name}</span>
                          </div>
                        </td>
                        <td style={{ ...S.td, color: accent, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.wins}</td>
                        <td style={{ ...S.td, color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18 }}>{s.losses}</td>
                        <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{pct}</td>
                        <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_for}</td>
                        <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13 }}>{s.pts_against}</td>
                        <td style={{ ...S.td, fontFamily: "'DM Mono', monospace", fontSize: 13, color: diff > 0 ? accent : diff < 0 ? '#FF453A' : '#6A6A82' }}>
                          {diff > 0 ? '+' : ''}{diff}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div style={S.modalOverlay} onClick={() => setShowShareModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>Share Standings</div>
              <button onClick={() => setShowShareModal(false)} style={S.modalClose}>×</button>
            </div>

            <div style={S.modalBody}>
              {generatingImg ? (
                <div style={{ textAlign: 'center' as const, padding: '60px 0', color: '#6A6A82' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13 }}>Generating image…</div>
                </div>
              ) : shareImgUrl ? (
                <>
                  <div style={S.previewWrap}>
                    <img src={shareImgUrl} alt="Standings preview" style={{ width: '100%', borderRadius: 10, display: 'block' }} />
                  </div>
                  <div style={S.shareActions}>
                    <button onClick={downloadImage} style={{ ...S.shareBtn, background: `${accent}18`, borderColor: `${accent}55`, color: accent }}>
                      ⬇ Download JPEG
                    </button>
                    <button
                      onClick={() => {
                        if (shareImgUrl) {
                          fetch(shareImgUrl).then(r => r.blob()).then(blob => {
                            navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': blob })])
                              .catch(() => downloadImage())
                          })
                        }
                      }}
                      style={S.shareBtn}
                    >
                      📋 Copy Image
                    </button>
                    <button onClick={downloadCsv} style={S.shareBtn}>⬇ CSV Export</button>
                  </div>
                  <p style={{ fontSize: 12, color: '#6A6A82', textAlign: 'center' as const, marginTop: 12 }}>
                    1080×1080 — perfect for Instagram, Twitter, group chats
                  </p>
                </>
              ) : (
                <div style={{ textAlign: 'center' as const, padding: '40px 0', color: '#FF453A' }}>Failed to generate image.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: '#040406', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, color: '#39FF14', letterSpacing: 2 }}>LOADING…</div>
    </div>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#040406', fontFamily: "'DM Sans', sans-serif", color: '#EEEEF5' },
  main: { maxWidth: 900, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 16 },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, marginBottom: 4 },
  sub: { color: '#6A6A82', fontSize: 14 },
  exportBtn: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontSize: 13, padding: '8px 16px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500 },
  empty: { textAlign: 'center' as const, padding: '60px 24px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#6A6A82', fontSize: 15, marginBottom: 16 },
  emptyLink: { fontSize: 14, textDecoration: 'none', fontFamily: "'DM Mono', monospace" },
  tableWrap: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'center' as const, fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", fontWeight: 400, padding: '14px 16px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  tr: { borderBottom: '1px solid #14141C', transition: 'background 0.15s' },
  td: { padding: '14px 16px', textAlign: 'center' as const, fontSize: 14 },
  teamCell: { display: 'flex', alignItems: 'center', gap: 10 },
  teamDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  // Modal
  modalOverlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modal: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 16, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #1C1C26' },
  modalTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase' as const, letterSpacing: 1 },
  modalClose: { background: 'none', border: 'none', color: '#6A6A82', fontSize: 24, cursor: 'pointer', lineHeight: 1 },
  modalBody: { padding: 24 },
  previewWrap: { background: '#040406', borderRadius: 10, overflow: 'hidden', marginBottom: 20 },
  shareActions: { display: 'flex', gap: 10, flexWrap: 'wrap' as const },
  shareBtn: { flex: 1, minWidth: 120, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontSize: 13, padding: '10px 14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textAlign: 'center' as const },
}
