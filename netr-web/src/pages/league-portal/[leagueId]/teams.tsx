import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { supabase, League, LeagueTeam, LeaguePlayer, LeagueDivision } from '../../../lib/supabase'
import { PortalNav } from './index'

type TeamWithPlayers = LeagueTeam & { players: LeaguePlayer[] }

const COLORS = ['#39FF14','#FF453A','#FF9500','#4A9EFF','#BF5AF2','#F5C542','#EEEEF5']

export default function TeamsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)

  // Add team form
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState('#39FF14')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit team
  const [editingTeam, setEditingTeam] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('#39FF14')
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null)
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null)
  const [editLogoCleared, setEditLogoCleared] = useState(false)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Add player
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerJersey, setPlayerJersey] = useState('')
  // Fee note editing
  const [editingFeeNote, setEditingFeeNote] = useState<string | null>(null)
  const [feeNoteValue, setFeeNoteValue] = useState('')

  const [saving, setSaving] = useState(false)
  const [showNetrInfo, setShowNetrInfo] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Divisions
  const [divisions, setDivisions]   = useState<LeagueDivision[]>([])
  const [divFilter, setDivFilter]   = useState<string>('all')
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [csvInput, setCsvInput] = useState('')
  const [csvTab, setCsvTab] = useState<'paste' | 'file'>('paste')
  const [csvPreview, setCsvPreview] = useState<{ teamName: string; players: { name: string; jersey: string; pos: string }[] }[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState('')
  const csvFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, playersRes, divisionsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId).order('created_at'),
        supabase.from('league_players').select('*, profiles(netr_score)').eq('league_id', leagueId),
        supabase.from('league_divisions').select('*').eq('league_id', leagueId).order('display_order'),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)

      const playersByTeam: Record<string, LeaguePlayer[]> = {}
      for (const p of (playersRes.data ?? [])) {
        if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        playersByTeam[p.team_id].push({ ...p, netr_score: (p as any).profiles?.netr_score ?? null })
      }

      setTeams((teamsRes.data ?? []).map(t => ({ ...t, players: playersByTeam[t.id] ?? [] })))
      setDivisions(divisionsRes.data ?? [])
      setLoading(false)
    })
  }, [leagueId])

  // ── Logo helpers ──────────────────────────────────────────────
  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0]
    if (!file) return
    const preview = URL.createObjectURL(file)
    if (isEdit) { setEditLogoFile(file); setEditLogoPreview(preview); setEditLogoCleared(false) }
    else { setLogoFile(file); setLogoPreview(preview) }
  }

  function clearAddLogo() {
    setLogoFile(null); setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function clearEditLogo() {
    setEditLogoFile(null); setEditLogoPreview(null); setEditLogoCleared(true)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  async function uploadLogo(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop()
    const path = `${leagueId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('team-logos').upload(path, file, { upsert: true })
    if (error) return null
    const { data: { publicUrl } } = supabase.storage.from('team-logos').getPublicUrl(path)
    return publicUrl
  }

  // ── Add team ──────────────────────────────────────────────────
  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    let logoUrl: string | null = null
    if (logoFile) logoUrl = await uploadLogo(logoFile)
    const { data } = await supabase
      .from('league_teams')
      .insert({ league_id: leagueId, name: teamName, color: teamColor, logo_url: logoUrl })
      .select().single()
    if (data) setTeams(prev => [...prev, { ...data, players: [] }])
    setTeamName(''); setTeamColor('#39FF14'); clearAddLogo()
    setShowTeamForm(false); setSaving(false)
  }

  // ── Edit team ─────────────────────────────────────────────────
  function startEdit(team: TeamWithPlayers) {
    setEditingTeam(team.id)
    setEditName(team.name)
    setEditColor(team.color)
    setEditLogoFile(null)
    setEditLogoPreview(team.logo_url ?? null)
    setEditLogoCleared(false)
  }

  function cancelEdit() {
    setEditingTeam(null)
    setEditLogoFile(null); setEditLogoPreview(null); setEditLogoCleared(false)
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  async function saveTeam(e: React.FormEvent, team: TeamWithPlayers) {
    e.preventDefault()
    setSaving(true)

    let logoUrl = team.logo_url
    if (editLogoFile) logoUrl = await uploadLogo(editLogoFile)
    else if (editLogoCleared) logoUrl = null

    const { data } = await supabase
      .from('league_teams')
      .update({ name: editName, color: editColor, logo_url: logoUrl })
      .eq('id', team.id)
      .select().single()

    if (data) setTeams(prev => prev.map(t => t.id === team.id ? { ...t, ...data } : t))
    cancelEdit(); setSaving(false)
  }

  // ── Players ───────────────────────────────────────────────────
  async function addPlayer(e: React.FormEvent, teamId: string) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase
      .from('league_players')
      .insert({ team_id: teamId, league_id: leagueId, display_name: playerName, jersey_number: playerJersey || null })
      .select().single()
    if (data) setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: [...t.players, data] } : t))
    setPlayerName(''); setPlayerJersey(''); setAddingPlayer(null); setSaving(false)
  }

  async function removePlayer(playerId: string, teamId: string) {
    await supabase.from('league_players').delete().eq('id', playerId)
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: t.players.filter(p => p.id !== playerId) } : t))
  }

  async function deleteTeam(teamId: string) {
    await supabase.from('league_teams').delete().eq('id', teamId)
    setTeams(prev => prev.filter(t => t.id !== teamId))
    setEditingTeam(null)
  }

  async function toggleFeePaid(team: TeamWithPlayers) {
    const newVal = !team.fee_paid
    setTeams(prev => prev.map(t => t.id === team.id ? { ...t, fee_paid: newVal } : t))
    const { data } = await supabase.from('league_teams').update({ fee_paid: newVal }).eq('id', team.id).select().single()
    if (!data) setTeams(prev => prev.map(t => t.id === team.id ? { ...t, fee_paid: team.fee_paid } : t))
  }

  async function saveFeeNote(teamId: string) {
    await supabase.from('league_teams').update({ fee_note: feeNoteValue || null }).eq('id', teamId)
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, fee_note: feeNoteValue || null } : t))
    setEditingFeeNote(null)
  }

  function parseCsv(raw: string) {
    const lines = raw.split('\n').map(l => l.trim()).filter(Boolean)
    const errors: string[] = []
    const byTeam: Record<string, { name: string; jersey: string; pos: string }[]> = {}
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim())
      if (i === 0 && cols[0].toLowerCase().includes('team')) continue // skip header
      const teamName = cols[0] ?? ''
      const playerName = cols[1] ?? ''
      if (!teamName || !playerName) { errors.push(`Row ${i + 1}: missing team or player name`); continue }
      if (!byTeam[teamName]) byTeam[teamName] = []
      byTeam[teamName].push({ name: playerName, jersey: cols[2] ?? '', pos: cols[3] ?? '' })
    }
    const preview = Object.entries(byTeam).map(([teamName, players]) => ({ teamName, players }))
    setCsvPreview(preview)
    setCsvErrors(errors)
  }

  function downloadTemplate() {
    const csv = 'Team Name,Player Name,Jersey,Position\nLakers,LeBron James,23,SF\nLakers,Anthony Davis,3,C\nCeltics,Jayson Tatum,0,SF\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'roster-template.csv'
    a.click()
  }

  async function handleCsvImport() {
    if (csvPreview.length === 0) return
    setImporting(true)
    const COLORS = ['#39FF14','#FF453A','#FF9500','#4A9EFF','#BF5AF2','#F5C542']
    let colorIdx = teams.length % COLORS.length
    let totalPlayers = 0

    for (const group of csvPreview) {
      const existing = teams.find(t => t.name.toLowerCase() === group.teamName.toLowerCase())
      let teamId = existing?.id
      if (!teamId) {
        const { data } = await supabase.from('league_teams')
          .insert({ league_id: leagueId, name: group.teamName, color: COLORS[colorIdx % COLORS.length] })
          .select().single()
        if (data) { teamId = data.id; colorIdx++ }
      }
      if (!teamId) continue
      const rows = group.players.map(p => ({
        team_id: teamId, league_id: leagueId,
        display_name: p.name,
        jersey_number: p.jersey || null,
        position: p.pos || null,
      }))
      await supabase.from('league_players').insert(rows)
      totalPlayers += rows.length
    }

    const [teamsRes, playersRes] = await Promise.all([
      supabase.from('league_teams').select('*').eq('league_id', leagueId).order('created_at'),
      supabase.from('league_players').select('*, profiles(netr_score)').eq('league_id', leagueId),
    ])
    const playersByTeam: Record<string, LeaguePlayer[]> = {}
    for (const p of (playersRes.data ?? [])) {
      if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playersByTeam[p.team_id].push({ ...p, netr_score: (p as any).profiles?.netr_score ?? null })
    }
    setTeams((teamsRes.data ?? []).map(t => ({ ...t, players: playersByTeam[t.id] ?? [] })))
    setImportDone(`Imported ${totalPlayers} players across ${csvPreview.length} teams.`)
    setCsvPreview([])
    setCsvInput('')
    setImporting(false)
  }

  function copyJoinLink(token: string) {
    navigator.clipboard.writeText(`${window.location.origin}/join/${token}`)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  async function assignTeamDivision(teamId: string, divisionId: string | null) {
    await supabase.from('league_teams').update({ division_id: divisionId }).eq('id', teamId)
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, division_id: divisionId } : t))
  }

  if (loading || !league) return <LoadingScreen />

  return (
    <>
      <Head>
        <title>Teams — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="teams" />

        <main style={S.main}>
          <div style={S.header}>
            <div>
              <h1 style={S.title}>Teams & Rosters</h1>
              <p style={S.sub}>{teams.length} team{teams.length !== 1 ? 's' : ''} · {teams.reduce((n, t) => n + t.players.length, 0)} players total</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowCsvModal(true); setImportDone('') }} style={S.importBtn}>⬆ Import CSV</button>
              <button onClick={() => setShowTeamForm(true)} style={S.addBtn}>+ Add Team</button>
            </div>
          </div>

          {/* Add team form */}
          {showTeamForm && (
            <form onSubmit={addTeam} style={S.inlineForm}>
              <TeamFormFields
                name={teamName} onName={setTeamName}
                color={teamColor} onColor={setTeamColor}
                logoPreview={logoPreview}
                onLogoChange={e => handleLogoChange(e, false)}
                onLogoClear={clearAddLogo}
                fileRef={fileInputRef}
              />
              <div style={S.formActions}>
                <button type="button" onClick={() => { setShowTeamForm(false); clearAddLogo() }} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.saveBtn} disabled={saving || !teamName}>{saving ? 'Adding…' : 'Add Team'}</button>
              </div>
            </form>
          )}

          {/* Division filter tabs */}
          {divisions.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, marginBottom: 20 }}>
              {[{ id: 'all', name: 'All Teams' }, ...divisions].map(d => (
                <button
                  key={d.id}
                  onClick={() => setDivFilter(d.id)}
                  style={{
                    background: divFilter === d.id ? 'rgba(57,255,20,0.12)' : '#0F0F14',
                    border: `1.5px solid ${divFilter === d.id ? '#39FF14' : '#1C1C26'}`,
                    borderRadius: 8,
                    color: divFilter === d.id ? '#39FF14' : '#6A6A82',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: 1,
                    padding: '8px 18px',
                    cursor: 'pointer',
                    textTransform: 'uppercase' as const,
                  }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

          {teams.length === 0 && !showTeamForm && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>👥</div>
              <p style={S.emptyText}>No teams yet. Add your first team to get started.</p>
            </div>
          )}

          {/* Team list */}
          <div style={S.teamList}>
            {teams.filter(t => divFilter === 'all' || t.division_id === divFilter).map(team => (
              <div key={team.id} style={S.teamCard}>

                {/* Edit form */}
                {editingTeam === team.id ? (
                  <form onSubmit={e => saveTeam(e, team)} style={S.editForm}>
                    <div style={S.editFormHeader}>
                      <span style={S.editFormTitle}>Edit Team</span>
                    </div>
                    <TeamFormFields
                      name={editName} onName={setEditName}
                      color={editColor} onColor={setEditColor}
                      logoPreview={editLogoPreview}
                      onLogoChange={e => handleLogoChange(e, true)}
                      onLogoClear={clearEditLogo}
                      fileRef={editFileInputRef}
                    />
                    <div style={{ ...S.formActions, justifyContent: 'space-between' as const }}>
                      <button
                        type="button"
                        onClick={() => { if (confirm(`Delete "${team.name}"? This will remove all players and game history for this team.`) ) deleteTeam(team.id) }}
                        style={{ background: 'none', border: '1px solid #FF445540', borderRadius: 8, color: '#FF4455', fontSize: 13, padding: '8px 16px', cursor: 'pointer' }}
                      >
                        Delete Team
                      </button>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={cancelEdit} style={S.cancelBtn}>Cancel</button>
                        <button type="submit" style={S.saveBtn} disabled={saving || !editName}>{saving ? 'Saving…' : 'Save Changes'}</button>
                      </div>
                    </div>
                  </form>
                ) : (
                  /* Team header */
                  <div style={S.teamHeader} onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                    <div style={S.teamLeft}>
                      {team.logo_url
                        ? <img src={team.logo_url} alt={team.name} style={S.teamLogo} />
                        : <div style={{ ...S.teamDot, background: team.color, boxShadow: `0 0 8px ${team.color}66` }} />
                      }
                      <div>
                        <div style={S.teamName}>{team.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                          <span style={S.teamCount}>{team.players.length} player{team.players.length !== 1 ? 's' : ''}</span>
                          {divisions.length > 0 && (
                            <select
                              value={team.division_id ?? ''}
                              onChange={e => { e.stopPropagation(); assignTeamDivision(team.id, e.target.value || null) }}
                              onClick={e => e.stopPropagation()}
                              style={{ background: '#0A0A0E', border: '1px solid #2A2A38', borderRadius: 6, color: team.division_id ? '#39FF14' : '#6A6A82', fontSize: 11, padding: '2px 6px', fontFamily: "'DM Mono', monospace", cursor: 'pointer' }}
                            >
                              <option value="">No Division</option>
                              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={S.teamRight}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleFeePaid(team) }}
                        style={{
                          ...S.paidPill,
                          background: team.fee_paid ? 'rgba(57,255,20,0.12)' : 'rgba(245,197,66,0.10)',
                          color: team.fee_paid ? '#39FF14' : '#F5C542',
                          border: `1px solid ${team.fee_paid ? 'rgba(57,255,20,0.3)' : 'rgba(245,197,66,0.3)'}`,
                        }}
                        title={team.fee_paid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        {team.fee_paid
                          ? `✓ Paid${league?.fee_amount ? ` $${league.fee_amount.toLocaleString()}` : ''}`
                          : `Unpaid${league?.fee_amount ? ` $${league.fee_amount.toLocaleString()}` : ''}`
                        }
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); startEdit(team) }}
                        style={S.editBtn}
                        title="Edit team"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); copyJoinLink(team.join_token) }}
                        style={S.shareBtn}
                      >
                        {copied === team.join_token ? '✓ Copied!' : '🔗 Share Link'}
                      </button>
                      <span style={S.chevron}>{expandedTeam === team.id ? '▲' : '▼'}</span>
                    </div>
                  </div>
                )}

                {/* Roster */}
                {expandedTeam === team.id && editingTeam !== team.id && (
                  <div style={S.roster}>
                    {team.players.length > 0 && (
                      <table style={S.table}>
                        <thead>
                          <tr>
                            {['#', 'Player', 'Status', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {team.players.map(p => (
                            <tr key={p.id} style={S.tr}>
                              <td style={S.td}><span style={S.jerseyNum}>{p.jersey_number ?? '—'}</span></td>
                              <td style={S.td}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                                  <span style={S.playerNameStyle}>{p.display_name}</span>
                                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                                  {(p as any).netr_score != null && <span onClick={()=>setShowNetrInfo(true)} style={{ background: 'rgba(57,255,20,0.12)', border: '1px solid rgba(57,255,20,0.3)', borderRadius: 4, color: '#39FF14', fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700, padding: '1px 6px', letterSpacing: 0.3, cursor: 'pointer', userSelect: 'none' as const }}>{((p as any).netr_score as number).toFixed(1)}</span>}
                                  {p.position && <span style={S.pos}>{p.position}</span>}
                                </div>
                              </td>
                              <td style={S.td}>
                                <span style={{ ...S.claimBadge, background: p.is_claimed ? 'rgba(57,255,20,0.12)' : 'rgba(245,197,66,0.12)', color: p.is_claimed ? '#39FF14' : '#F5C542' }}>
                                  {p.is_claimed ? 'Claimed' : 'Unclaimed'}
                                </span>
                              </td>
                              <td style={S.td}>
                                <button onClick={() => removePlayer(p.id, team.id)} style={S.removeBtn} title="Remove">×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Fee note */}
                    <div style={S.feeNoteRow}>
                      {editingFeeNote === team.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                          <input
                            value={feeNoteValue}
                            onChange={e => setFeeNoteValue(e.target.value)}
                            style={{ ...S.input, flex: 1, marginBottom: 0, fontSize: 12, padding: '6px 10px' }}
                            placeholder="e.g. paid cash 4/15, short $50…"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') saveFeeNote(team.id); if (e.key === 'Escape') setEditingFeeNote(null) }}
                          />
                          <button onClick={() => saveFeeNote(team.id)} style={{ ...S.saveBtn, fontSize: 12, padding: '6px 14px' }}>Save</button>
                          <button onClick={() => setEditingFeeNote(null)} style={{ ...S.cancelBtn, fontSize: 12, padding: '6px 12px' }}>Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingFeeNote(team.id); setFeeNoteValue(team.fee_note ?? '') }}
                          style={S.feeNoteBtn}
                        >
                          {team.fee_note ? `📝 ${team.fee_note}` : '+ Add payment note'}
                        </button>
                      )}
                    </div>


                    {addingPlayer === team.id ? (
                      <form onSubmit={e => addPlayer(e, team.id)} style={S.playerForm}>
                        <div style={S.playerFormRow}>
                          <input value={playerName} onChange={e => setPlayerName(e.target.value)} style={{ ...S.input, flex: 2, marginBottom: 0 }} placeholder="Player name *" required autoFocus />
                          <input value={playerJersey} onChange={e => setPlayerJersey(e.target.value)} style={{ ...S.input, flex: '0 0 70px', marginBottom: 0 }} placeholder="#" maxLength={3} />
                          <button type="submit" style={S.saveBtn} disabled={saving || !playerName}>{saving ? '…' : 'Add'}</button>
                          <button type="button" onClick={() => setAddingPlayer(null)} style={S.cancelBtn}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <button onClick={() => { setAddingPlayer(team.id); setExpandedTeam(team.id) }} style={S.addPlayerBtn}>
                        + Add Player
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </main>
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div style={S.overlay}>
          <div style={S.csvModal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={S.csvModalTitle}>Import Roster CSV</div>
              <button onClick={() => { setShowCsvModal(false); setCsvPreview([]); setCsvInput(''); setImportDone('') }} style={S.closeBtn}>✕</button>
            </div>

            {importDone ? (
              <div style={{ textAlign: 'center' as const, padding: '40px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ color: '#39FF14', fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, fontWeight: 700 }}>{importDone}</div>
                <button onClick={() => { setShowCsvModal(false); setImportDone('') }} style={{ ...S.saveBtn, marginTop: 24 }}>Done</button>
              </div>
            ) : (
              <>
                {/* Instructions */}
                <div style={S.csvInstructions}>
                  <div style={S.csvInstTitle}>CSV Format</div>
                  <pre style={S.csvCode}>{`Team Name,Player Name,Jersey,Position\nLakers,LeBron James,23,SF\nLakers,Anthony Davis,3,C\nCeltics,Jayson Tatum,0,SF`}</pre>
                  <div style={S.csvInstGrid}>
                    <div><strong style={{ color: '#EEEEF5' }}>Google Sheets:</strong> File → Download → Comma-separated values</div>
                    <div><strong style={{ color: '#EEEEF5' }}>Excel:</strong> File → Save As → CSV UTF-8 (Comma delimited)</div>
                    <div><strong style={{ color: '#EEEEF5' }}>Numbers (Mac):</strong> File → Export To → CSV</div>
                  </div>
                  <button onClick={downloadTemplate} style={S.templateBtn}>⬇ Download Template</button>
                </div>

                {/* Input tabs */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderBottom: '1px solid #1C1C26' }}>
                  {(['paste', 'file'] as const).map(t => (
                    <button key={t} onClick={() => setCsvTab(t)} style={{ ...S.csvTabBtn, ...(csvTab === t ? S.csvTabActive : {}) }}>
                      {t === 'paste' ? 'Paste CSV' : 'Upload File'}
                    </button>
                  ))}
                </div>

                {csvTab === 'paste' ? (
                  <textarea
                    value={csvInput}
                    onChange={e => { setCsvInput(e.target.value); parseCsv(e.target.value) }}
                    placeholder="Paste your CSV here…"
                    rows={6}
                    style={S.csvTextarea}
                  />
                ) : (
                  <div style={S.csvFileZone}>
                    <input ref={csvFileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      file.text().then(text => { setCsvInput(text); parseCsv(text) })
                    }} />
                    <button onClick={() => csvFileRef.current?.click()} style={S.templateBtn}>Choose CSV File</button>
                    {csvInput && <span style={{ fontSize: 12, color: '#39FF14', marginLeft: 12 }}>File loaded ✓</span>}
                  </div>
                )}

                {/* Errors */}
                {csvErrors.length > 0 && (
                  <div style={S.csvErrorBox}>
                    {csvErrors.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}

                {/* Preview */}
                {csvPreview.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 10 }}>
                      Preview — {csvPreview.reduce((n, g) => n + g.players.length, 0)} players · {csvPreview.length} teams
                    </div>
                    {csvPreview.map(group => (
                      <div key={group.teamName} style={S.csvPreviewGroup}>
                        <div style={S.csvPreviewTeam}>{group.teamName} <span style={{ color: '#6A6A82', fontWeight: 400 }}>({group.players.length})</span></div>
                        {group.players.map((p, i) => (
                          <div key={i} style={S.csvPreviewPlayer}>
                            {p.jersey && <span style={{ color: '#6A6A82', fontFamily: "'DM Mono', monospace", minWidth: 28, display: 'inline-block' }}>#{p.jersey}</span>}
                            {p.name}
                            {p.pos && <span style={{ color: '#6A6A82', marginLeft: 8 }}>{p.pos}</span>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Import button */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button onClick={() => { setCsvPreview([]); setCsvInput('') }} style={S.cancelBtn} disabled={csvPreview.length === 0}>Clear</button>
                  <button onClick={handleCsvImport} style={S.saveBtn} disabled={csvPreview.length === 0 || importing}>
                    {importing ? 'Importing…' : `Import ${csvPreview.reduce((n, g) => n + g.players.length, 0)} Players`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* NETR Rating info popup */}
      {showNetrInfo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowNetrInfo(false)}>
          <div style={{ background: '#0F0F14', border: '1px solid #2E2E3A', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 480, position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowNetrInfo(false)} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: '1px solid #2E2E3A', borderRadius: 8, color: '#C8C8D4', fontSize: 16, width: 32, height: 32, cursor: 'pointer' }}>✕</button>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 38, color: '#39FF14', letterSpacing: 3, lineHeight: 1, marginBottom: 6 }}>NETR</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6A6A82', letterSpacing: 2, textTransform: 'uppercase' as const }}>The Modern Rating System</div>
            </div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: '#EEEEF5', marginBottom: 12, textTransform: 'uppercase' as const }}>What&apos;s a NETR Rating?</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#C8C8D4', lineHeight: 1.7, marginBottom: 14 }}>
              NETR is basketball&apos;s first peer-to-peer skill rating system. Players earn their score from real feedback — given by the people they actually played with, after every run. No self-reporting. No algorithms.
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#C8C8D4', lineHeight: 1.7, marginBottom: 24 }}>
              The number next to a player&apos;s name is their verified NETR score — built from real games and real competition.
            </p>
            <a href="https://apps.apple.com/us/app/netr-rating/id6761962317" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', background: '#39FF14', color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: 1.5, textTransform: 'uppercase' as const, textAlign: 'center' as const, padding: '16px 24px', borderRadius: 12, textDecoration: 'none' }}>
              Download NETR — Free on the App Store
            </a>
          </div>
        </div>
      )}
    </>
  )
}

// ── Shared form fields component ─────────────────────────────────
function TeamFormFields({ name, onName, color, onColor, logoPreview, onLogoChange, onLogoClear, fileRef }: {
  name: string
  onName: (v: string) => void
  color: string
  onColor: (v: string) => void
  logoPreview: string | null
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onLogoClear: () => void
  fileRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <div style={S.formRow}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <label style={S.label}>Team Name *</label>
        <input value={name} onChange={e => onName(e.target.value)} style={S.input} placeholder="e.g. Ballers" required autoFocus />
      </div>

      <div>
        <label style={S.label}>Logo (optional)</label>
        <div style={S.logoUploadRow}>
          {logoPreview ? (
            <div style={S.logoPreviewWrap}>
              <img src={logoPreview} alt="Logo" style={S.logoPreviewImg} />
              <button type="button" onClick={onLogoClear} style={S.logoRemoveBtn} title="Remove">×</button>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} style={S.logoPickerBtn}>
              <span>🖼️</span><span>Upload Logo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={onLogoChange} style={{ display: 'none' }} />
        </div>
      </div>

      <div>
        <label style={S.label}>Color</label>
        <div style={S.colorRow}>
          {COLORS.map(c => (
            <button key={c} type="button" onClick={() => onColor(c)}
              style={{ ...S.colorSwatch, background: c, border: color === c ? '2px solid #fff' : '2px solid transparent' }} />
          ))}
        </div>
      </div>
    </div>
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
  main: { maxWidth: 1200, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 16 },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, marginBottom: 4 },
  sub: { color: '#6A6A82', fontSize: 14 },
  addBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 8, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' as const, padding: '10px 20px', cursor: 'pointer' },
  inlineForm: { background: '#0F0F14', border: '1px solid #39FF1444', borderRadius: 12, padding: 24, marginBottom: 20 },
  editForm: { background: '#0F0F14', borderBottom: '1px solid #1C1C26', padding: 24 },
  editFormHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  editFormTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#6A6A82' },
  formRow: { display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-end', marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 },
  input: { background: '#0A0A0D', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, marginBottom: 0 },
  logoUploadRow: { display: 'flex', alignItems: 'center', gap: 10 },
  logoPickerBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#0A0A0D', border: '1px dashed #2E2E3A', borderRadius: 8, color: '#6A6A82', fontFamily: "'DM Sans', sans-serif", fontSize: 13, padding: '8px 14px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  logoPreviewWrap: { position: 'relative' as const, display: 'inline-flex' },
  logoPreviewImg: { width: 48, height: 48, borderRadius: 8, objectFit: 'cover' as const, border: '1px solid #2E2E3A' },
  logoRemoveBtn: { position: 'absolute' as const, top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#FF4545', border: 'none', color: '#fff', fontSize: 12, lineHeight: '18px', textAlign: 'center' as const, cursor: 'pointer', padding: 0 },
  colorRow: { display: 'flex', gap: 8, paddingTop: 4 },
  colorSwatch: { width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', padding: 0, flexShrink: 0 },
  formActions: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
  cancelBtn: { background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 8, color: '#6A6A82', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '8px 18px', cursor: 'pointer' },
  saveBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 8, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 22px', cursor: 'pointer' },
  empty: { textAlign: 'center' as const, padding: '60px 24px' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#6A6A82', fontSize: 15 },
  teamList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  teamCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 12, overflow: 'hidden' },
  teamHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', cursor: 'pointer', userSelect: 'none' as const },
  teamLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  teamLogo: { width: 40, height: 40, borderRadius: 8, objectFit: 'cover' as const, flexShrink: 0 },
  teamDot: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  teamCount: { fontSize: 12, color: '#6A6A82' },
  teamRight: { display: 'flex', alignItems: 'center', gap: 10 },
  paidPill: { borderRadius: 99, fontFamily: "'DM Mono', monospace", fontSize: 12, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' as const, fontWeight: 500 },
  editBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  shareBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  chevron: { color: '#6A6A82', fontSize: 12, fontFamily: "'DM Mono', monospace" },
  roster: { borderTop: '1px solid #1C1C26', padding: '16px 20px 20px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 14 },
  th: { textAlign: 'left' as const, fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", padding: '0 12px 10px 0', fontWeight: 400 },
  tr: { borderBottom: '1px solid #14141C' },
  td: { padding: '10px 12px 10px 0', fontSize: 14 },
  jerseyNum: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 13 },
  playerNameStyle: { fontWeight: 500 },
  linkedBadge: { marginLeft: 8, background: 'rgba(57,255,20,0.12)', color: '#39FF14', fontSize: 10, fontFamily: "'DM Mono', monospace", padding: '2px 7px', borderRadius: 99, letterSpacing: 0.5 },
  pos: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 12 },
  claimBadge: { fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '2px 8px', borderRadius: 99, letterSpacing: 0.5 },
  removeBtn: { background: 'none', border: 'none', color: '#FF4545', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  playerForm: { marginTop: 8 },
  playerFormRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  addPlayerBtn: { background: 'none', border: '1px dashed #2E2E3A', borderRadius: 8, color: '#6A6A82', fontSize: 13, padding: '8px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' as const, marginTop: 4 },
  feeNoteRow: { display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 4, borderBottom: '1px solid #14141C' },
  feeNoteBtn: { background: 'none', border: 'none', color: '#6A6A82', fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: 'pointer', padding: '4px 0', textAlign: 'left' as const },
  importBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 18px', cursor: 'pointer' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  csvModal: { background: '#0F0F14', border: '1px solid #2E2E3A', borderRadius: 16, padding: 32, width: '100%', maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' as const },
  csvModalTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, textTransform: 'uppercase' as const },
  closeBtn: { background: 'none', border: '1px solid #2E2E3A', borderRadius: 8, color: '#6A6A82', fontSize: 16, width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  csvInstructions: { background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 10, padding: 16, marginBottom: 20 },
  csvInstTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: 1, color: '#6A6A82', marginBottom: 8 },
  csvCode: { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#39FF14', background: '#040406', border: '1px solid #1C1C26', borderRadius: 6, padding: '10px 14px', margin: '0 0 12px', overflowX: 'auto' as const, whiteSpace: 'pre' as const },
  csvInstGrid: { display: 'flex', flexDirection: 'column' as const, gap: 6, fontSize: 12, color: '#6A6A82', lineHeight: 1.5, marginBottom: 12 },
  templateBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Mono', monospace", fontSize: 12, padding: '7px 14px', cursor: 'pointer' },
  csvTabBtn: { background: 'none', border: 'none', borderBottom: '2px solid transparent', color: '#6A6A82', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 1, padding: '10px 18px', cursor: 'pointer' },
  csvTabActive: { color: '#39FF14', borderBottomColor: '#39FF14' },
  csvTextarea: { width: '100%', background: '#0A0A0E', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Mono', monospace", fontSize: 12, padding: '12px 14px', outline: 'none', resize: 'vertical' as const, boxSizing: 'border-box' as const, minHeight: 120 },
  csvFileZone: { background: '#0A0A0E', border: '1px dashed #2E2E3A', borderRadius: 8, padding: '24px', display: 'flex', alignItems: 'center', marginBottom: 12 },
  csvErrorBox: { background: 'rgba(255,68,85,0.08)', border: '1px solid rgba(255,68,85,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#FF8899', fontFamily: "'DM Mono', monospace", marginTop: 8 },
  csvPreviewGroup: { marginBottom: 14 },
  csvPreviewTeam: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6 },
  csvPreviewPlayer: { fontSize: 13, color: '#A0A0B8', padding: '3px 0', borderBottom: '1px solid #14141C' },
}
