import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { supabase, League } from '../../../lib/supabase'
import { PortalNav } from './index'
import { STAT_DEFS, DEFAULT_ENABLED_STATS, StatKey } from '../../../lib/stat-config'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function useSaveState() {
  const [state, setState] = useState<SaveState>('idle')
  function trigger(thenable: PromiseLike<unknown>) {
    setState('saving')
    Promise.resolve(thenable).then(() => {
      setState('saved')
      setTimeout(() => setState('idle'), 2500)
    }).catch(() => {
      setState('error')
      setTimeout(() => setState('idle'), 3000)
    })
  }
  return { state, trigger }
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  const map: Record<SaveState, { text: string; color: string }> = {
    idle:   { text: '',          color: '' },
    saving: { text: 'Saving…',  color: '#6A6A82' },
    saved:  { text: '✓ Saved',  color: '#39FF14' },
    error:  { text: '✗ Error',  color: '#FF4455' },
  }
  const { text, color } = map[state]
  return <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color }}>{text}</span>
}

export default function SettingsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }

  const [league, setLeague]         = useState<League | null>(null)
  const [loading, setLoading]       = useState(true)
  const [showDelete, setShowDelete] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]     = useState(false)

  // League details form
  const [name, setName]           = useState('')
  const [season, setSeason]       = useState('')
  const [location, setLocation]   = useState('')
  const [defGameLoc, setDefGameLoc] = useState('')
  const [description, setDescription] = useState('')
  const [feeAmount, setFeeAmount] = useState<string>('')
  const detailsSave = useSaveState()

  // Stat config
  const [enabledStats, setEnabledStats] = useState<StatKey[]>([])
  const [minGames, setMinGames]         = useState(1)
  const [statDisplay, setStatDisplay]   = useState<'per_game' | 'totals'>('per_game')
  const statsSave = useSaveState()

  // Active status
  const [isActive, setIsActive]   = useState(true)
  const statusSave = useSaveState()

  // Logo upload
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl]       = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const logoSave = useSaveState()

  // Schedule & playoff settings
  const [gamesPerTeam, setGamesPerTeam]   = useState(10)
  const [playoffTeams, setPlayoffTeams]   = useState(4)
  const [playoffFormat, setPlayoffFormat] = useState('single_elimination')
  const scheduleSave = useSaveState()

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const { data } = await supabase
        .from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single()

      if (!data) { router.replace('/league-portal'); return }

      setLeague(data)
      setName(data.name)
      setSeason(data.season ?? '')
      setLocation(data.location ?? '')
      setDefGameLoc(data.default_game_location ?? '')
      setDescription(data.description ?? '')
      setFeeAmount(data.fee_amount != null ? String(data.fee_amount) : '')
      setEnabledStats((data.enabled_stats ?? DEFAULT_ENABLED_STATS) as StatKey[])
      setMinGames(data.min_games_for_stats ?? 1)
      setStatDisplay(data.stat_display ?? 'per_game')
      setIsActive(data.is_active)
      setLogoUrl(data.logo_url ?? null)
      setGamesPerTeam(data.games_per_team ?? 10)
      setPlayoffTeams(data.playoff_teams ?? 4)
      setPlayoffFormat(data.playoff_format ?? 'single_elimination')
      setLoading(false)
    })
  }, [leagueId])

  function saveDetails(e: React.FormEvent) {
    e.preventDefault()
    const parsedFee = feeAmount.trim() ? parseInt(feeAmount.trim(), 10) : null
    detailsSave.trigger(
      supabase.from('leagues').update({
        name: name.trim(),
        season: season.trim() || null,
        location: location.trim() || null,
        default_game_location: defGameLoc.trim() || null,
        description: description.trim() || null,
        fee_amount: isNaN(parsedFee as number) ? null : parsedFee,
      }).eq('id', leagueId)
    )
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${leagueId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('league-logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('league-logos').getPublicUrl(path)
      setLogoUrl(publicUrl)
      logoSave.trigger(supabase.from('leagues').update({ logo_url: publicUrl }).eq('id', leagueId))
    }
    setLogoUploading(false)
  }

  function saveScheduleSettings(e: React.FormEvent) {
    e.preventDefault()
    scheduleSave.trigger(
      supabase.from('leagues').update({
        games_per_team: gamesPerTeam,
        playoff_teams: playoffTeams,
        playoff_format: playoffFormat,
      }).eq('id', leagueId)
    )
  }

  function toggleStat(key: StatKey) {
    const next = enabledStats.includes(key)
      ? enabledStats.filter(k => k !== key)
      : [...enabledStats, key]
    setEnabledStats(next)
    statsSave.trigger(supabase.from('leagues').update({ enabled_stats: next }).eq('id', leagueId))
  }

  function saveStatRules() {
    statsSave.trigger(
      supabase.from('leagues').update({
        min_games_for_stats: minGames,
        stat_display: statDisplay,
      }).eq('id', leagueId)
    )
  }

  function toggleActive() {
    const next = !isActive
    setIsActive(next)
    statusSave.trigger(supabase.from('leagues').update({ is_active: next }).eq('id', leagueId))
  }

  async function handleDelete() {
    if (deleteConfirm !== league?.name) return
    setDeleting(true)
    await supabase.from('leagues').delete().eq('id', leagueId)
    router.replace('/league-portal')
  }

  if (loading || !league) return <LoadingScreen />

  return (
    <>
      <Head>
        <title>Settings — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="settings" logoUrl={logoUrl} />

        <main style={S.main}>
          <h1 style={S.pageTitle}>Commissioner Settings</h1>

          {/* ── League Identity (logo) ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>League Identity</div>
                <div style={S.cardSub}>Your league logo appears next to the league name in the dashboard and in the NETR app.</div>
              </div>
              <SaveIndicator state={logoSave.state} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' as const }}>
              {logoUrl && (
                <img src={logoUrl} alt="League logo" style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', border: '1px solid #2A2A38' }} />
              )}
              <div>
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
                <button type="button" onClick={() => logoInputRef.current?.click()} style={S.saveBtn} disabled={logoUploading}>
                  {logoUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                <div style={{ ...S.hint, marginTop: 8 }}>PNG, JPG, or WebP · Recommended: 512×512px</div>
                <div style={{ ...S.hint, marginTop: 4 }}>⚠ Requires the <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>league-logos</code> storage bucket — run the SQL at the bottom of migration 004 in your Supabase dashboard first.</div>
              </div>
            </div>
          </div>

          {/* ── Schedule & Playoffs ── */}
          <form onSubmit={saveScheduleSettings} style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Schedule &amp; Playoffs</div>
                <div style={S.cardSub}>Used by the Schedule Generator and playoff bracket.</div>
              </div>
              <SaveIndicator state={scheduleSave.state} />
            </div>
            <div style={S.fieldGrid}>
              <div style={S.field}>
                <label style={S.label}>Games Per Team</label>
                <input type="number" min={1} max={82} value={gamesPerTeam} onChange={e => setGamesPerTeam(parseInt(e.target.value) || 1)} style={S.input} />
                <div style={S.hint}>How many regular season games each team plays.</div>
              </div>
              <div style={S.field}>
                <label style={S.label}>Playoff Teams</label>
                <select value={playoffTeams} onChange={e => setPlayoffTeams(parseInt(e.target.value))} style={S.input}>
                  <option value={0}>No playoffs</option>
                  <option value={2}>2 teams</option>
                  <option value={4}>4 teams</option>
                  <option value={6}>6 teams</option>
                  <option value={8}>8 teams</option>
                </select>
                <div style={S.hint}>How many teams advance to the postseason.</div>
              </div>
              <div style={S.field}>
                <label style={S.label}>Playoff Format</label>
                <select value={playoffFormat} onChange={e => setPlayoffFormat(e.target.value)} style={S.input}>
                  <option value="single_elimination">Single Elimination</option>
                  <option value="double_elimination" disabled>Double Elimination — coming soon</option>
                </select>
              </div>
            </div>
            <div style={S.cardFoot}>
              <button type="submit" style={S.saveBtn} disabled={scheduleSave.state === 'saving'}>
                {scheduleSave.state === 'saving' ? 'Saving…' : 'Save Schedule Settings'}
              </button>
            </div>
          </form>

          {/* ── League Details ── */}
          <form onSubmit={saveDetails} style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>League Details</div>
                <div style={S.cardSub}>Basic info visible to players and on the public league page.</div>
              </div>
              <SaveIndicator state={detailsSave.state} />
            </div>

            <div style={S.fieldGrid}>
              <div style={S.field}>
                <label style={S.label}>League Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={S.input}
                  placeholder="Monday Night Hoops"
                />
              </div>
              <div style={S.field}>
                <label style={S.label}>Season</label>
                <input
                  value={season}
                  onChange={e => setSeason(e.target.value)}
                  style={S.input}
                  placeholder="Spring 2026"
                />
              </div>
              <div style={S.field}>
                <label style={S.label}>League Location</label>
                <input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  style={S.input}
                  placeholder="Brooklyn, NY"
                />
              </div>
              <div style={S.field}>
                <label style={S.label}>Default Game Venue</label>
                <input
                  value={defGameLoc}
                  onChange={e => setDefGameLoc(e.target.value)}
                  style={S.input}
                  placeholder="Pro Performance Arena, Court 2"
                />
                <div style={S.hint}>Pre-fills the location when you schedule a game.</div>
              </div>
              <div style={S.field}>
                <label style={S.label}>Team Entry Fee ($)</label>
                <input
                  type="number"
                  min={0}
                  value={feeAmount}
                  onChange={e => setFeeAmount(e.target.value)}
                  style={S.input}
                  placeholder="e.g. 1200"
                />
                <div style={S.hint}>Optional. Shows on each team's payment status in the Teams page.</div>
              </div>
            </div>

            <div style={S.field}>
              <label style={S.label}>Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={S.textarea}
                placeholder="Tell players what this league is about…"
              />
            </div>

            <div style={S.cardFoot}>
              <button type="submit" style={S.saveBtn} disabled={detailsSave.state === 'saving'}>
                {detailsSave.state === 'saving' ? 'Saving…' : 'Save Details'}
              </button>
            </div>
          </form>

          {/* ── Tracked Stats ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Tracked Stats</div>
                <div style={S.cardSub}>Only enabled stats appear in box score entry and the leaderboard.</div>
              </div>
              <SaveIndicator state={statsSave.state} />
            </div>

            <div style={S.toggleGrid}>
              {STAT_DEFS.map(def => {
                const on = enabledStats.includes(def.key)
                return (
                  <button
                    key={def.key}
                    type="button"
                    onClick={() => toggleStat(def.key)}
                    style={{ ...S.toggleChip, ...(on ? S.toggleOn : S.toggleOff) }}
                  >
                    <span style={S.chipLabel}>{def.label}</span>
                    <span style={{ ...S.chipFull, color: on ? '#6A9A6A' : '#3A3A4E' }}>{def.fullLabel}</span>
                  </button>
                )
              })}
            </div>

            <div style={S.statNote}>
              💡 For FG%, 3P%, and FT% — the box score asks for makes and attempts, not the percentage. The math is automatic.
            </div>
          </div>

          {/* ── Leaderboard Rules ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Leaderboard Rules</div>
                <div style={S.cardSub}>Controls how the Stats Leaders page works.</div>
              </div>
              <SaveIndicator state={statsSave.state} />
            </div>

            <div style={S.fieldRow}>
              <div style={S.field}>
                <label style={S.label}>Minimum games to qualify</label>
                <div style={S.hint}>Players must have this many games to appear in the leaderboard. Keeps the list fair when the season starts.</div>
                <div style={S.segGroup}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setMinGames(n); saveStatRules() }}
                      style={{ ...S.seg, ...(minGames === n ? S.segActive : {}) }}
                    >
                      {n} {n === 1 ? 'game' : 'games'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={S.field}>
                <label style={S.label}>Stat display</label>
                <div style={S.hint}>How player stats are shown in the leaderboard.</div>
                <div style={S.segGroup}>
                  {([['per_game', 'Per Game'], ['totals', 'Season Totals']] as const).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => { setStatDisplay(val); saveStatRules() }}
                      style={{ ...S.seg, ...(statDisplay === val ? S.segActive : {}) }}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Season Status ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Season Status</div>
                <div style={S.cardSub}>Archived leagues are read-only and hidden from your active list.</div>
              </div>
              <SaveIndicator state={statusSave.state} />
            </div>

            <div style={S.statusRow}>
              <div>
                <div style={S.statusLabel}>{isActive ? '● Active' : '○ Archived'}</div>
                <div style={S.hint}>{isActive ? 'Season is live. Stats and standings update with each game.' : 'Season is archived. Scores and stats are locked.'}</div>
              </div>
              <button
                type="button"
                onClick={toggleActive}
                style={{ ...S.toggleBtn, ...(isActive ? S.toggleBtnArchive : S.toggleBtnActivate) }}
              >
                {isActive ? 'Archive Season' : 'Reactivate Season'}
              </button>
            </div>
          </div>

          {/* ── League Page ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>League Page</div>
                <div style={S.cardSub}>Share this link with your players — standings, schedule, and results. No login required.</div>
              </div>
            </div>
            <div style={S.leagueLinkRow}>
              <code style={S.leagueLinkCode}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/league/{league.slug}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/league/${league.slug}`)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2500)
                }}
                style={S.copyBtn}
              >
                {linkCopied ? '✓ Copied!' : 'Copy Link'}
              </button>
              <a
                href={`/league/${league.slug}`}
                target="_blank"
                rel="noreferrer"
                style={S.previewLink}
              >
                Preview ↗
              </a>
            </div>
          </div>

          {/* ── Danger Zone ── */}
          <div style={{ ...S.card, ...S.dangerCard }}>
            <div style={S.cardHead}>
              <div>
                <div style={{ ...S.cardTitle, color: '#FF4455' }}>Danger Zone</div>
                <div style={S.cardSub}>Permanent actions. Cannot be undone.</div>
              </div>
            </div>

            {!showDelete ? (
              <button type="button" onClick={() => setShowDelete(true)} style={S.deleteBtn}>
                Delete League…
              </button>
            ) : (
              <div style={S.deleteConfirmBox}>
                <div style={S.deleteWarning}>
                  This will permanently delete <strong style={{ color: '#EEEEF5' }}>{league.name}</strong> including all teams, players, games, and stats. There is no undo.
                </div>
                <label style={S.label}>Type the league name to confirm</label>
                <input
                  value={deleteConfirm}
                  onChange={e => setDeleteConfirm(e.target.value)}
                  style={{ ...S.input, borderColor: '#FF444533' }}
                  placeholder={league.name}
                />
                <div style={S.deleteActions}>
                  <button type="button" onClick={() => { setShowDelete(false); setDeleteConfirm('') }} style={S.cancelBtn}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteConfirm !== league.name || deleting}
                    style={{ ...S.deleteBtn, opacity: deleteConfirm !== league.name ? 0.4 : 1 }}
                  >
                    {deleting ? 'Deleting…' : 'Delete League Forever'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
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
  main: { maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' },
  pageTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 36,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 28,
    lineHeight: 1,
  },

  // Cards
  card: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 14,
    padding: '24px',
    marginBottom: 20,
  },
  dangerCard: { borderColor: '#FF444522' },
  cardHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  cardTitle: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 20,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  cardSub: { fontSize: 13, color: '#6A6A82', lineHeight: 1.5 },
  cardFoot: { marginTop: 20, display: 'flex', justifyContent: 'flex-end' as const },

  // Form fields
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px 20px',
    marginBottom: 16,
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 24,
  },
  field: { display: 'flex', flexDirection: 'column' as const, gap: 6 },
  label: {
    fontSize: 12,
    color: '#AAAABC',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  hint: { fontSize: 12, color: '#6A6A82', lineHeight: 1.5, marginTop: 2 },
  input: {
    background: '#0A0A0E',
    border: '1px solid #2A2A38',
    borderRadius: 8,
    color: '#EEEEF5',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  textarea: {
    background: '#0A0A0E',
    border: '1px solid #2A2A38',
    borderRadius: 8,
    color: '#EEEEF5',
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
    resize: 'vertical' as const,
  },
  saveBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    border: 'none',
    borderRadius: 8,
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '10px 28px',
    cursor: 'pointer',
  },

  // Stat toggles
  toggleGrid: { display: 'flex', flexWrap: 'wrap' as const, gap: 10, marginBottom: 16 },
  toggleChip: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 16px',
    cursor: 'pointer',
    textAlign: 'left' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 2,
    minWidth: 80,
  },
  toggleOn:  { background: 'rgba(57,255,20,0.12)', outline: '1.5px solid #39FF14' },
  toggleOff: { background: '#0A0A0E',              outline: '1.5px solid #1C1C26' },
  chipLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.5,
    color: '#EEEEF5',
  },
  chipFull: { fontSize: 10, fontFamily: "'DM Mono', monospace", whiteSpace: 'nowrap' as const },
  statNote: {
    fontSize: 12,
    color: '#6A6A82',
    lineHeight: 1.6,
    background: '#0A0A0E',
    border: '1px solid #1C1C26',
    borderRadius: 8,
    padding: '10px 14px',
  },

  // Segmented controls
  segGroup: { display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginTop: 6 },
  seg: {
    background: '#0A0A0E',
    border: '1.5px solid #1C1C26',
    borderRadius: 8,
    color: '#6A6A82',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 0.5,
    padding: '8px 18px',
    cursor: 'pointer',
    textTransform: 'uppercase' as const,
    transition: 'all 0.15s',
  },
  segActive: {
    background: 'rgba(57,255,20,0.12)',
    borderColor: '#39FF14',
    color: '#39FF14',
  },

  // Season status
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  statusLabel: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 18,
    marginBottom: 4,
  },
  toggleBtn: {
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    padding: '10px 22px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  toggleBtnArchive: { background: '#1C1C26', color: '#6A6A82' },
  toggleBtnActivate: { background: 'rgba(57,255,20,0.12)', color: '#39FF14', outline: '1.5px solid #39FF14' },

  // Danger zone
  deleteBtn: {
    background: 'rgba(255,68,85,0.1)',
    border: '1.5px solid rgba(255,68,85,0.3)',
    borderRadius: 8,
    color: '#FF4455',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    padding: '10px 22px',
    cursor: 'pointer',
  },
  deleteConfirmBox: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
  },
  deleteWarning: {
    fontSize: 14,
    color: '#FF8899',
    lineHeight: 1.6,
    background: 'rgba(255,68,85,0.06)',
    border: '1px solid rgba(255,68,85,0.15)',
    borderRadius: 8,
    padding: '12px 16px',
  },
  deleteActions: { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' as const },
  cancelBtn: {
    background: 'transparent',
    border: '1px solid #2A2A38',
    borderRadius: 8,
    color: '#6A6A82',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    textTransform: 'uppercase' as const,
    padding: '10px 22px',
    cursor: 'pointer',
  },
  leagueLinkRow: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const },
  leagueLinkCode: {
    flex: 1,
    minWidth: 200,
    background: '#0A0A0E',
    border: '1px solid #2A2A38',
    borderRadius: 8,
    color: '#39FF14',
    fontFamily: "'DM Mono', monospace",
    fontSize: 13,
    padding: '10px 14px',
    wordBreak: 'break-all' as const,
  },
  copyBtn: {
    background: 'rgba(57,255,20,0.12)',
    border: '1px solid rgba(57,255,20,0.3)',
    borderRadius: 8,
    color: '#39FF14',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    padding: '10px 20px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  },
  previewLink: {
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },
}
