import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { supabase, fetchAllCourts, League, LeagueSponsor, LeagueGalleryPhoto, LeagueDivision } from '../../../lib/supabase'
import { LEAGUE_FONTS } from '../../../lib/league-fonts'
import { CourtPicker } from '../../../components/CourtPicker'
import { PortalNav } from './index'
import { STAT_DEFS, DEFAULT_ENABLED_STATS, StatKey } from '../../../lib/stat-config'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function useSaveState() {
  const [state, setState] = useState<SaveState>('idle')
  function trigger(thenable: PromiseLike<{ error?: unknown } | null | undefined>) {
    setState('saving')
    Promise.resolve(thenable).then((result) => {
      if (result && (result as { error?: unknown }).error) {
        console.error('Save error:', (result as { error?: unknown }).error)
        setState('error')
        setTimeout(() => setState('idle'), 3000)
      } else {
        setState('saved')
        setTimeout(() => setState('idle'), 2500)
      }
    }).catch((err) => {
      console.error('Save exception:', err)
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

  // Announcement
  const [announcement, setAnnouncement] = useState('')
  const announcementSave = useSaveState()

  // Stat config
  const [enabledStats, setEnabledStats] = useState<StatKey[]>([])
  const [minGames, setMinGames]         = useState(1)
  const [statDisplay, setStatDisplay]   = useState<'per_game' | 'totals'>('per_game')
  const statsSave = useSaveState()

  // Active status
  const [isActive, setIsActive]   = useState(true)
  const statusSave = useSaveState()

  // Logo / banner / branding
  const logoInputRef   = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)
  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [bannerUrl, setBannerUrl]       = useState<string | null>(null)
  const [accentColor, setAccentColor]   = useState<string>('#39FF14')
  const [accentInput, setAccentInput]   = useState<string>('#39FF14')
  const [logoUploading, setLogoUploading]     = useState(false)
  const [bannerUploading, setBannerUploading] = useState(false)
  const logoSave   = useSaveState()
  const brandingSave = useSaveState()

  // Courts (NETR court picker)
  const [courts, setCourts]               = useState<{ id: string; name: string; city: string }[]>([])
  const [defaultCourtId, setDefaultCourtId] = useState<string | null>(null)

  // Settings tab
  const [sTab, setSTab] = useState<'general'|'appearance'|'website'|'schedule'|'danger'>('general')

  // Divisions
  const [divisions, setDivisions]       = useState<LeagueDivision[]>([])
  const [newDivName, setNewDivName]     = useState('')
  const [editingDiv, setEditingDiv]     = useState<string | null>(null)
  const [editDivName, setEditDivName]   = useState('')
  const [savingDiv, setSavingDiv]       = useState(false)

  // Font & signup CTA
  const [leagueFont, setLeagueFont]   = useState('barlow')
  const [signupUrl, setSignupUrl]     = useState('')
  const [signupLabel, setSignupLabel] = useState('')
  const fontSave   = useSaveState()
  const signupSave = useSaveState()

  // Schedule & playoff settings
  const [gamesPerTeam, setGamesPerTeam]   = useState(10)
  const [playoffTeams, setPlayoffTeams]   = useState(4)
  const [playoffFormat, setPlayoffFormat] = useState('single_elimination')
  const scheduleSave = useSaveState()

  // Custom domain
  const [customDomain, setCustomDomain]           = useState('')
  const [customDomainStatus, setCustomDomainStatus] = useState<'pending'|'active'|'error'|null>(null)
  const [domainInput, setDomainInput]             = useState('')
  const [checkingDomain, setCheckingDomain]       = useState(false)
  const [setupLinkCopied, setSetupLinkCopied]     = useState(false)
  const [cnameCopied, setCnameCopied]             = useState(false)
  const domainSave = useSaveState()

  // Contact & social
  const [contactInfo, setContactInfo]   = useState('')
  const [socialLinks, setSocialLinks]   = useState<Record<string,string>>({})
  const contactSave = useSaveState()

  // Sponsors
  const [sponsors, setSponsors]           = useState<LeagueSponsor[]>([])
  const [newSponsorName, setNewSponsorName]     = useState('')
  const [newSponsorLogo, setNewSponsorLogo]     = useState('')
  const [newSponsorUrl, setNewSponsorUrl]       = useState('')
  const [addingSponsor, setAddingSponsor]       = useState(false)

  // Gallery
  const [galleryPhotos, setGalleryPhotos]       = useState<LeagueGalleryPhoto[]>([])
  const [newPhotoUrl, setNewPhotoUrl]           = useState('')
  const [newPhotoCaption, setNewPhotoCaption]   = useState('')
  const [addingPhoto, setAddingPhoto]           = useState(false)
  const [photoUploading, setPhotoUploading]     = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

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
      setAnnouncement(data.announcement ?? '')
      setEnabledStats((data.enabled_stats ?? DEFAULT_ENABLED_STATS) as StatKey[])
      setMinGames(data.min_games_for_stats ?? 1)
      setStatDisplay(data.stat_display ?? 'per_game')
      setIsActive(data.is_active)
      setLogoUrl(data.logo_url ?? null)
      setBannerUrl(data.banner_url ?? null)
      const color = data.accent_color ?? '#39FF14'
      setAccentColor(color)
      setAccentInput(color)
      setGamesPerTeam(data.games_per_team ?? 10)
      setPlayoffTeams(data.playoff_teams ?? 4)
      setPlayoffFormat(data.playoff_format ?? 'single_elimination')
      setCustomDomain(data.custom_domain ?? '')
      setDomainInput(data.custom_domain ?? '')
      setCustomDomainStatus(data.custom_domain_status ?? null)
      setDefaultCourtId(data.default_court_id ?? null)
      setLeagueFont(data.league_font ?? 'barlow')
      setSignupUrl(data.signup_url ?? '')
      setSignupLabel(data.signup_label ?? '')
      setContactInfo(data.contact_info ?? '')
      setSocialLinks(data.social_links ?? {})

      const [sponsorsRes, galleryRes, courtsRes, divisionsRes] = await Promise.all([
        supabase.from('league_sponsors').select('*').eq('league_id', leagueId).order('display_order'),
        supabase.from('league_gallery_photos').select('*').eq('league_id', leagueId).order('created_at', { ascending: false }),
        fetchAllCourts(),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
      ])
      setSponsors(sponsorsRes.data ?? [])
      setGalleryPhotos(galleryRes.data ?? [])
      setCourts(courtsRes ?? [])
      setDivisions(divisionsRes.data ?? [])
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

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBannerUploading(true)
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `${leagueId}/banner-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('league-logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('league-logos').getPublicUrl(path)
      setBannerUrl(publicUrl)
      brandingSave.trigger(supabase.from('leagues').update({ banner_url: publicUrl }).eq('id', leagueId))
    }
    setBannerUploading(false)
  }

  function saveAccentColor(color: string) {
    setAccentColor(color)
    setAccentInput(color)
    brandingSave.trigger(supabase.from('leagues').update({ accent_color: color }).eq('id', leagueId))
  }

  function saveAnnouncement() {
    announcementSave.trigger(
      supabase.from('leagues').update({ announcement: announcement.trim() || null }).eq('id', leagueId)
    )
  }

  function clearAnnouncement() {
    setAnnouncement('')
    announcementSave.trigger(
      supabase.from('leagues').update({ announcement: null }).eq('id', leagueId)
    )
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

  function saveContact() {
    contactSave.trigger(
      supabase.from('leagues').update({ contact_info: contactInfo.trim() || null, social_links: Object.keys(socialLinks).length ? socialLinks : null }).eq('id', leagueId)
    )
  }

  function setSocial(platform: string, value: string) {
    setSocialLinks(prev => ({ ...prev, [platform]: value.trim() }))
  }

  async function addSponsor(e: React.FormEvent) {
    e.preventDefault()
    if (!newSponsorName.trim()) return
    setAddingSponsor(true)
    const { data } = await supabase.from('league_sponsors').insert({
      league_id: leagueId,
      name: newSponsorName.trim(),
      logo_url: newSponsorLogo.trim() || null,
      website_url: newSponsorUrl.trim() || null,
      display_order: sponsors.length,
    }).select().single()
    if (data) setSponsors(prev => [...prev, data])
    setNewSponsorName(''); setNewSponsorLogo(''); setNewSponsorUrl('')
    setAddingSponsor(false)
  }

  async function removeSponsor(id: string) {
    await supabase.from('league_sponsors').delete().eq('id', id)
    setSponsors(prev => prev.filter(s => s.id !== id))
  }

  async function uploadPhotoToCloudinary(file: File): Promise<string | null> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    if (!cloudName) return null
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', 'league_gallery')
    const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
    const json = await r.json()
    return json.secure_url ?? null
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    const url = await uploadPhotoToCloudinary(file)
    if (url) setNewPhotoUrl(url)
    setPhotoUploading(false)
  }

  async function addPhoto(e: React.FormEvent) {
    e.preventDefault()
    if (!newPhotoUrl.trim()) return
    setAddingPhoto(true)
    const { data } = await supabase.from('league_gallery_photos').insert({
      league_id: leagueId,
      photo_url: newPhotoUrl.trim(),
      caption: newPhotoCaption.trim() || null,
    }).select().single()
    if (data) setGalleryPhotos(prev => [data, ...prev])
    setNewPhotoUrl(''); setNewPhotoCaption('')
    setAddingPhoto(false)
  }

  async function removePhoto(id: string) {
    await supabase.from('league_gallery_photos').delete().eq('id', id)
    setGalleryPhotos(prev => prev.filter(p => p.id !== id))
  }

  async function saveCustomDomainFn(e: React.FormEvent) {
    e.preventDefault()
    const cleaned = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
    if (!cleaned) return
    setCustomDomain(cleaned)
    setCustomDomainStatus('pending')
    domainSave.trigger(
      supabase.from('leagues').update({ custom_domain: cleaned, custom_domain_status: 'pending' }).eq('id', leagueId)
    )
  }

  async function removeDomain() {
    setCustomDomain('')
    setDomainInput('')
    setCustomDomainStatus(null)
    await supabase.from('leagues').update({ custom_domain: null, custom_domain_status: 'pending' }).eq('id', leagueId)
  }

  async function checkDomainStatus() {
    setCheckingDomain(true)
    try {
      const res = await fetch('/api/league/check-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leagueId }),
      })
      const { status } = await res.json()
      setCustomDomainStatus(status)
    } finally {
      setCheckingDomain(false)
    }
  }

  async function addDivision(e: React.FormEvent) {
    e.preventDefault()
    if (!newDivName.trim()) return
    setSavingDiv(true)
    const { data } = await supabase.from('league_divisions').insert({
      league_id: leagueId,
      name: newDivName.trim(),
      display_order: divisions.length,
    }).select().single()
    if (data) setDivisions(prev => [...prev, data])
    setNewDivName('')
    setSavingDiv(false)
  }

  async function deleteDiv(id: string) {
    await supabase.from('league_divisions').delete().eq('id', id)
    setDivisions(prev => prev.filter(d => d.id !== id))
  }

  async function saveDivName(id: string) {
    if (!editDivName.trim()) return
    await supabase.from('league_divisions').update({ name: editDivName.trim() }).eq('id', id)
    setDivisions(prev => prev.map(d => d.id === id ? { ...d, name: editDivName.trim() } : d))
    setEditingDiv(null)
  }

  async function moveDivision(id: string, dir: -1 | 1) {
    const idx = divisions.findIndex(d => d.id === id)
    const next = idx + dir
    if (next < 0 || next >= divisions.length) return
    const reordered = [...divisions]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    const updated = reordered.map((d, i) => ({ ...d, display_order: i }))
    setDivisions(updated)
    await Promise.all(updated.map(d => supabase.from('league_divisions').update({ display_order: d.display_order }).eq('id', d.id)))
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 12 }}>
            <h1 style={{ ...S.pageTitle, marginBottom: 0 }}>Settings</h1>
            <div style={{ display: 'flex', gap: 4, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 12, padding: 4, flexWrap: 'wrap' as const }}>
              {([
                ['general',   '⚙ General'],
                ['appearance','🎨 Look & Feel'],
                ['website',   '🌐 Website'],
                ['schedule',  '📅 Stats & Schedule'],
                ['danger',    '⚠'],
              ] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setSTab(key)} style={{
                  background: sTab === key ? (key === 'danger' ? '#FF445520' : '#39FF1420') : 'none',
                  border: `1px solid ${sTab === key ? (key === 'danger' ? '#FF4455' : '#39FF14') : 'transparent'}`,
                  borderRadius: 8,
                  color: sTab === key ? (key === 'danger' ? '#FF4455' : '#39FF14') : '#6A6A82',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  padding: '7px 14px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap' as const,
                  transition: 'all 0.15s',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {sTab === 'appearance' && <>
          {/* ── League Branding ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>League Branding</div>
                <div style={S.cardSub}>Customize how your public league page looks. Players see this when they open your link.</div>
              </div>
              <SaveIndicator state={brandingSave.state || logoSave.state} />
            </div>

            {/* Banner */}
            <div style={S.brandingSection}>
              <div style={S.brandingLabel}>Banner Image</div>
              <div style={S.hint}>Full-width hero image at the top of your league page. Recommended: 1400×400px, JPG or PNG.</div>
              <div style={{ marginTop: 12 }}>
                {bannerUrl && (
                  <div style={{ marginBottom: 12, borderRadius: 10, overflow: 'hidden', border: '1px solid #2A2A38', maxHeight: 120 }}>
                    <img src={bannerUrl} alt="Banner" style={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
                <input ref={bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleBannerUpload} />
                <button type="button" onClick={() => bannerInputRef.current?.click()} style={S.uploadBtn} disabled={bannerUploading}>
                  {bannerUploading ? 'Uploading…' : bannerUrl ? 'Change Banner' : 'Upload Banner'}
                </button>
              </div>
            </div>

            {/* Logo */}
            <div style={S.brandingSection}>
              <div style={S.brandingLabel}>League Logo</div>
              <div style={S.hint}>Shown in the header of your league page. Recommended: 512×512px square.</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                {logoUrl && (
                  <img src={logoUrl} alt="League logo" style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '1px solid #2A2A38', flexShrink: 0 }} />
                )}
                <div>
                  <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleLogoUpload} />
                  <button type="button" onClick={() => logoInputRef.current?.click()} style={S.uploadBtn} disabled={logoUploading}>
                    {logoUploading ? 'Uploading…' : logoUrl ? 'Change Logo' : 'Upload Logo'}
                  </button>
                </div>
              </div>
            </div>

            {/* Accent Color */}
            <div style={S.brandingSection}>
              <div style={S.brandingLabel}>Accent Color</div>
              <div style={S.hint}>Applied to standings, score highlights, and section titles on your league page.</div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 14 }}>
                  {['#39FF14','#FF453A','#FF9500','#FFD60A','#4A9EFF','#BF5AF2','#FF375F','#00C8FF','#FF6B35','#FFFFFF'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => saveAccentColor(c)}
                      title={c}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: c,
                        border: accentColor === c ? '3px solid #EEEEF5' : '2px solid transparent',
                        outline: accentColor === c ? `3px solid ${c}` : 'none',
                        outlineOffset: 2,
                        cursor: 'pointer',
                        padding: 0,
                        flexShrink: 0,
                        boxSizing: 'border-box' as const,
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: accentColor, border: '1px solid #2A2A38', flexShrink: 0 }} />
                  <input
                    value={accentInput}
                    onChange={e => setAccentInput(e.target.value)}
                    onBlur={() => { if (/^#[0-9A-Fa-f]{6}$/.test(accentInput)) saveAccentColor(accentInput) }}
                    onKeyDown={e => { if (e.key === 'Enter' && /^#[0-9A-Fa-f]{6}$/.test(accentInput)) saveAccentColor(accentInput) }}
                    style={{ ...S.input, width: 120, fontFamily: "'DM Mono', monospace", fontSize: 13 }}
                    placeholder="#39FF14"
                    maxLength={7}
                  />
                  <span style={S.hint}>Custom hex</span>
                </div>
              </div>
            </div>

            <div style={S.hint}>⚠ Requires the <code style={{ fontFamily: "'DM Mono', monospace", fontSize: 11 }}>league-logos</code> storage bucket in Supabase.</div>
          </div>

          {/* ── League Font ── */}
          <div style={S.card}>
            <Head>
              <link href={`https://fonts.googleapis.com/css2?${Object.values(LEAGUE_FONTS).map(f=>`family=${f.gf}`).join('&')}&display=swap`} rel="stylesheet"/>
            </Head>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Display Font</div>
                <div style={S.cardSub}>Applied to headings on your public league page. Body text is always clean and readable.</div>
              </div>
              <SaveIndicator state={fontSave.state} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10, marginTop: 4 }}>
              {Object.entries(LEAGUE_FONTS).map(([key, f]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setLeagueFont(key)
                    fontSave.trigger(supabase.from('leagues').update({ league_font: key }).eq('id', leagueId))
                  }}
                  style={{
                    background: leagueFont === key ? '#1A2A1A' : '#10101A',
                    border: `2px solid ${leagueFont === key ? '#39FF14' : '#2A2A38'}`,
                    borderRadius: 10,
                    padding: '14px 12px',
                    cursor: 'pointer',
                    textAlign: 'left' as const,
                  }}
                >
                  <div style={{ fontFamily: f.family, fontWeight: 700, fontSize: 20, color: '#EEEEF5', lineHeight: 1.1, marginBottom: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.preview}
                  </div>
                  <div style={{ fontSize: 11, color: leagueFont === key ? '#39FF14' : '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                    {f.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Sign Up CTA ── */}
          <form onSubmit={e => { e.preventDefault(); signupSave.trigger(supabase.from('leagues').update({ signup_url: signupUrl.trim() || null, signup_label: signupLabel.trim() || null }).eq('id', leagueId)) }} style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Sign Up Button</div>
                <div style={S.cardSub}>A prominent call-to-action button on your public homepage. Link to a Google Form, payment page, Eventbrite, or any URL.</div>
              </div>
              <SaveIndicator state={signupSave.state} />
            </div>
            <div style={S.fieldGrid}>
              <div style={S.field}>
                <label style={S.label}>Destination URL</label>
                <input value={signupUrl} onChange={e => setSignupUrl(e.target.value)} style={S.input} placeholder="https://forms.google.com/…" type="url"/>
                <div style={S.hint}>Google Form, payment link, Jotform, Stripe, PayPal — anything with a URL works.</div>
              </div>
              <div style={S.field}>
                <label style={S.label}>Button Label (optional)</label>
                <input value={signupLabel} onChange={e => setSignupLabel(e.target.value)} style={S.input} placeholder="Join the League"/>
                <div style={S.hint}>Defaults to "Join the League" if left blank.</div>
              </div>
            </div>
            <div style={S.cardFoot}>
              <button type="submit" style={S.saveBtn} disabled={signupSave.state === 'saving'}>
                {signupSave.state === 'saving' ? 'Saving…' : 'Save CTA'}
              </button>
            </div>
          </form>
          </>}

          {sTab === 'schedule' && <>
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
          </>}

          {sTab === 'general' && <>
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
                {courts.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <CourtPicker
                      courts={courts}
                      courtId={defaultCourtId ?? ''}
                      onChange={(id, courtName) => {
                        const newId = id || null
                        setDefaultCourtId(newId)
                        if (courtName) setDefGameLoc(courtName)
                        supabase.from('leagues').update({ default_court_id: newId }).eq('id', leagueId).then()
                      }}
                    />
                  </div>
                )}
                <input
                  value={defGameLoc}
                  onChange={e => setDefGameLoc(e.target.value)}
                  style={S.input}
                  placeholder="Pro Performance Arena, Court 2"
                />
                <div style={S.hint}>
                  {defaultCourtId
                    ? '✓ Linked to NETR court — league games will appear on the court page in the app.'
                    : 'Pre-fills location when scheduling. Link to a NETR court to show league games in the app.'}
                </div>
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
          </>}

          {sTab === 'schedule' && <>
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
          </>}

          {sTab === 'general' && <>
          {/* ── Divisions ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Divisions</div>
                <div style={S.cardSub}>Split your league into separate divisions (A, B, C or any name). Each division gets its own schedule, standings, stats, and playoffs. Teams without a division assigned compete in the main league view.</div>
              </div>
            </div>

            {divisions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
                {divisions.map((div, i) => (
                  <div key={div.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2, marginRight: 4 }}>
                      <button type="button" onClick={() => moveDivision(div.id, -1)} disabled={i === 0} style={{ background: 'none', border: 'none', color: i === 0 ? '#2A2A38' : '#6A6A82', cursor: i === 0 ? 'default' : 'pointer', padding: '0 4px', fontSize: 12, lineHeight: 1 }}>▲</button>
                      <button type="button" onClick={() => moveDivision(div.id, 1)} disabled={i === divisions.length - 1} style={{ background: 'none', border: 'none', color: i === divisions.length - 1 ? '#2A2A38' : '#6A6A82', cursor: i === divisions.length - 1 ? 'default' : 'pointer', padding: '0 4px', fontSize: 12, lineHeight: 1 }}>▼</button>
                    </div>
                    {editingDiv === div.id ? (
                      <>
                        <input
                          value={editDivName}
                          onChange={e => setEditDivName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveDivName(div.id); if (e.key === 'Escape') setEditingDiv(null) }}
                          autoFocus
                          style={{ ...S.input, flex: 1, padding: '6px 10px', fontSize: 14 }}
                        />
                        <button type="button" onClick={() => saveDivName(div.id)} style={{ ...S.saveBtn, padding: '6px 14px', fontSize: 13 }}>Save</button>
                        <button type="button" onClick={() => setEditingDiv(null)} style={{ ...S.cancelBtn, padding: '6px 14px', fontSize: 13 }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 17, textTransform: 'uppercase' as const, letterSpacing: 0.5, flex: 1 }}>{div.name}</span>
                        <button type="button" onClick={() => { setEditingDiv(div.id); setEditDivName(div.name) }} style={{ background: 'none', border: '1px solid #2A2A38', borderRadius: 6, color: '#6A6A82', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>Rename</button>
                        <button type="button" onClick={() => deleteDiv(div.id)} style={{ background: 'none', border: '1px solid #FF445530', borderRadius: 6, color: '#FF4455', fontSize: 12, padding: '5px 10px', cursor: 'pointer' }}>Delete</button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={addDivision} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' as const }}>
              <input
                value={newDivName}
                onChange={e => setNewDivName(e.target.value)}
                placeholder={divisions.length === 0 ? 'e.g. A Division, Elite, Pro…' : 'New division name…'}
                style={{ ...S.input, flex: 1, minWidth: 180 }}
              />
              <button type="submit" style={S.saveBtn} disabled={savingDiv || !newDivName.trim()}>
                {savingDiv ? 'Adding…' : '+ Add Division'}
              </button>
            </form>

            {divisions.length === 0 && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#6A6A82', lineHeight: 1.5 }}>
                No divisions yet — your league runs as a single group. Add divisions to separate teams into tiers like A / B / C.
              </div>
            )}
          </div>
          </>}

          {sTab === 'general' && <>
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

          {/* ── Announcement ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Announcement</div>
                <div style={S.cardSub}>Shows as a banner at the top of your public league page. Use it for cancellations, reminders, or league news.</div>
              </div>
              <SaveIndicator state={announcementSave.state} />
            </div>
            <textarea
              value={announcement}
              onChange={e => setAnnouncement(e.target.value)}
              rows={3}
              style={S.textarea}
              placeholder="e.g. ⚠️ Tonight's games are CANCELLED due to gym conflict. Next game: Thu May 7 @ 7pm."
            />
            <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' as const }}>
              {announcement && (
                <button type="button" onClick={clearAnnouncement} style={S.cancelBtn}>
                  Clear
                </button>
              )}
              <button type="button" onClick={saveAnnouncement} style={S.saveBtn} disabled={announcementSave.state === 'saving'}>
                {announcementSave.state === 'saving' ? 'Saving…' : 'Post Announcement'}
              </button>
            </div>
          </div>
          </>}

          {sTab === 'website' && <>
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
          </>}

          {sTab === 'appearance' && <>
          {/* ── Contact & Social ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Contact & Social</div>
                <div style={S.cardSub}>Contact info shows as a button on your public page. Social handles appear as icons in the header.</div>
              </div>
              <SaveIndicator state={contactSave.state} />
            </div>
            <label style={S.label}>Contact Info</label>
            <input value={contactInfo} onChange={e => setContactInfo(e.target.value)} style={S.input} placeholder="e.g. mondayhoops@gmail.com or (212) 555-0100" />
            <div style={{ marginTop: 20, marginBottom: 10 }}>
              <label style={S.label}>Social Handles</label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginBottom: 14 }}>
              {[
                { key: 'instagram', label: 'Instagram', prefix: '@', placeholder: 'yourleague' },
                { key: 'twitter',   label: 'Twitter / X', prefix: '@', placeholder: 'yourleague' },
                { key: 'facebook',  label: 'Facebook', prefix: '', placeholder: 'yourleaguepage' },
                { key: 'tiktok',    label: 'TikTok', prefix: '@', placeholder: 'yourleague' },
                { key: 'youtube',   label: 'YouTube', prefix: '@', placeholder: 'yourleague' },
                { key: 'website',   label: 'Website', prefix: '', placeholder: 'https://yourleague.com' },
              ].map(({ key, label, prefix, placeholder }) => (
                <div key={key}>
                  <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono',monospace", marginBottom: 5 }}>{label}</div>
                  <div style={{ display: 'flex', alignItems: 'center', background: '#0A0A0E', border: '1px solid #2E2E3A', borderRadius: 8 }}>
                    {prefix && <span style={{ padding: '0 8px', color: '#4A4A5E', fontFamily: "'DM Mono',monospace", fontSize: 13 }}>{prefix}</span>}
                    <input value={socialLinks[key] ?? ''} onChange={e => setSocial(key, e.target.value)} placeholder={placeholder}
                      style={{ ...S.input, border: 'none', background: 'transparent', flex: 1, borderRadius: 0 }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' as const }}>
              <button type="button" onClick={saveContact} style={S.saveBtn} disabled={contactSave.state === 'saving'}>
                {contactSave.state === 'saving' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          </>}

          {sTab === 'website' && <>
          {/* ── Sponsors ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Sponsors</div>
                <div style={S.cardSub}>Sponsor logos and names shown on your public league page.</div>
              </div>
            </div>
            {sponsors.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
                {sponsors.map(sp => (
                  <div key={sp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, padding: '10px 14px' }}>
                    {sp.logo_url && <img src={sp.logo_url} alt={sp.name} style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 6, background: '#fff', padding: 3 }} />}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const }}>{sp.name}</div>
                      {sp.website_url && <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono',monospace" }}>{sp.website_url}</div>}
                    </div>
                    <button onClick={() => removeSponsor(sp.id)} style={{ background: 'none', border: 'none', color: '#FF4455', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addSponsor} style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={S.label}>Sponsor Name *</label>
                  <input value={newSponsorName} onChange={e => setNewSponsorName(e.target.value)} style={S.input} placeholder="Acme Corp" />
                </div>
                <div>
                  <label style={S.label}>Logo URL</label>
                  <input value={newSponsorLogo} onChange={e => setNewSponsorLogo(e.target.value)} style={S.input} placeholder="https://acme.com/logo.png" />
                </div>
              </div>
              <div>
                <label style={S.label}>Website URL</label>
                <input value={newSponsorUrl} onChange={e => setNewSponsorUrl(e.target.value)} style={S.input} placeholder="https://acme.com" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' as const }}>
                <button type="submit" style={S.saveBtn} disabled={addingSponsor || !newSponsorName.trim()}>
                  {addingSponsor ? 'Adding…' : '+ Add Sponsor'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Gallery ── */}
          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Photo Gallery</div>
                <div style={S.cardSub}>Photos shown in the Gallery tab on your public league page.{process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? ' Upload directly or paste a URL.' : ' Paste a direct image URL (Cloudinary, Google Photos, Imgur, etc.).'}</div>
              </div>
            </div>
            {galleryPhotos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(100px,1fr))', gap: 8, marginBottom: 16 }}>
                {galleryPhotos.map(p => (
                  <div key={p.id} style={{ position: 'relative' as const, borderRadius: 8, overflow: 'hidden', aspectRatio: '1' }}>
                    <img src={p.photo_url} alt={p.caption ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => removePhoto(p.id)} style={{ position: 'absolute' as const, top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', borderRadius: '50%', width: 22, height: 22, cursor: 'pointer', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' as const }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={addPhoto} style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
              <div>
                <label style={S.label}>Photo URL</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newPhotoUrl} onChange={e => setNewPhotoUrl(e.target.value)} style={{ ...S.input, flex: 1 }} placeholder="https://res.cloudinary.com/..." />
                  {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME && (
                    <>
                      <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoFileChange} />
                      <button type="button" onClick={() => photoInputRef.current?.click()} style={{ ...S.cancelBtn, whiteSpace: 'nowrap' as const }} disabled={photoUploading}>
                        {photoUploading ? 'Uploading…' : '↑ Upload'}
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div>
                <label style={S.label}>Caption (optional)</label>
                <input value={newPhotoCaption} onChange={e => setNewPhotoCaption(e.target.value)} style={S.input} placeholder="Finals night — May 2025" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' as const }}>
                <button type="submit" style={S.saveBtn} disabled={addingPhoto || !newPhotoUrl.trim()}>
                  {addingPhoto ? 'Adding…' : '+ Add Photo'}
                </button>
              </div>
            </form>
          </div>

          {/* ── Custom Domain ── */}

          <div style={S.card}>
            <div style={S.cardHead}>
              <div>
                <div style={S.cardTitle}>Custom Domain</div>
                <div style={S.cardSub}>Serve your league page at your own domain (e.g. myleague.com). Requires a one-time DNS change.</div>
              </div>
              <SaveIndicator state={domainSave.state} />
            </div>

            {!customDomain ? (
              <form onSubmit={saveCustomDomainFn} style={{ display: 'flex', gap: 10 }}>
                <input
                  value={domainInput}
                  onChange={e => setDomainInput(e.target.value)}
                  style={{ ...S.input, flex: 1 }}
                  placeholder="myleague.com"
                  type="text"
                />
                <button type="submit" style={S.saveBtn} disabled={!domainInput.trim()}>
                  Save
                </button>
              </form>
            ) : (
              <div>
                {/* Status row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <span style={{ fontSize: 18 }}>
                    {customDomainStatus === 'active' ? '🟢' : customDomainStatus === 'error' ? '🔴' : '⚪'}
                  </span>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: customDomainStatus === 'active' ? '#39FF14' : customDomainStatus === 'error' ? '#FF4455' : '#6A6A82' }}>
                    {customDomainStatus === 'active' ? `Live at ${customDomain}` : customDomainStatus === 'error' ? 'DNS not found — check your record' : `Pending — waiting for DNS`}
                  </span>
                </div>

                {/* CNAME record box */}
                <div style={{ background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 12 }}>Add this DNS record</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: '8px 16px', marginBottom: 14 }}>
                    {[['Type', 'CNAME'], ['Host', '@'], ['Value', 'leagues.netr.pro'], ['TTL', '3600']].map(([label, value]) => (
                      <div key={label} style={{ display: 'contents' }}>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#6A6A82', paddingTop: 2 }}>{label}</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: '#EEEEF5' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText('leagues.netr.pro'); setCnameCopied(true); setTimeout(() => setCnameCopied(false), 2000) }}
                    style={{ ...S.copyBtn, width: '100%', justifyContent: 'center' as const }}
                  >
                    {cnameCopied ? '✓ Copied!' : 'Copy Value: leagues.netr.pro'}
                  </button>
                  <div style={{ marginTop: 10, fontSize: 12, color: '#4A4A5E', fontFamily: "'DM Mono',monospace" }}>
                    www.{customDomain} will also work automatically
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={checkDomainStatus}
                    disabled={checkingDomain}
                    style={S.saveBtn}
                  >
                    {checkingDomain ? 'Checking…' : 'Check Status'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/domain-setup?domain=${customDomain}`
                      navigator.clipboard.writeText(url)
                      setSetupLinkCopied(true)
                      setTimeout(() => setSetupLinkCopied(false), 2500)
                    }}
                    style={S.cancelBtn}
                  >
                    {setupLinkCopied ? '✓ Link Copied!' : 'Send to your web person →'}
                  </button>
                  <button
                    type="button"
                    onClick={removeDomain}
                    style={{ background: 'none', border: 'none', color: '#4A4A5E', fontSize: 12, fontFamily: "'DM Mono',monospace", cursor: 'pointer', textDecoration: 'underline', marginLeft: 'auto' as const }}
                  >
                    Remove domain
                  </button>
                </div>
              </div>
            )}
          </div>
          </>}

          {sTab === 'danger' && <>
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
          </>}

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
  brandingSection: { marginBottom: 28, paddingBottom: 28, borderBottom: '1px solid #1C1C26' },
  brandingLabel: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 4, color: '#EEEEF5' },
  uploadBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '9px 18px', cursor: 'pointer' },
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
