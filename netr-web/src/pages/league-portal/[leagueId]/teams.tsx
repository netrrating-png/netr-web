import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import { supabase, League, LeagueTeam, LeaguePlayer } from '../../../lib/supabase'
import { PortalNav } from './index'

type TeamWithPlayers = LeagueTeam & { players: LeaguePlayer[] }

export default function TeamsPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<TeamWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamName, setTeamName] = useState('')
  const [teamColor, setTeamColor] = useState('#39FF14')
  const [addingPlayer, setAddingPlayer] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [playerJersey, setPlayerJersey] = useState('')
  const [playerPos, setPlayerPos] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }

      const [leagueRes, teamsRes, playersRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId).order('created_at'),
        supabase.from('league_players').select('*').eq('league_id', leagueId),
      ])

      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)

      const playersByTeam: Record<string, LeaguePlayer[]> = {}
      for (const p of (playersRes.data ?? [])) {
        if (!playersByTeam[p.team_id]) playersByTeam[p.team_id] = []
        playersByTeam[p.team_id].push(p)
      }

      setTeams((teamsRes.data ?? []).map(t => ({ ...t, players: playersByTeam[t.id] ?? [] })))
      setLoading(false)
    })
  }, [leagueId])

  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase
      .from('league_teams')
      .insert({ league_id: leagueId, name: teamName, color: teamColor })
      .select()
      .single()
    if (data) setTeams(prev => [...prev, { ...data, players: [] }])
    setTeamName('')
    setTeamColor('#39FF14')
    setShowTeamForm(false)
    setSaving(false)
  }

  async function addPlayer(e: React.FormEvent, teamId: string) {
    e.preventDefault()
    setSaving(true)
    const { data } = await supabase
      .from('league_players')
      .insert({ team_id: teamId, league_id: leagueId, display_name: playerName, jersey_number: playerJersey || null, position: playerPos || null })
      .select()
      .single()
    if (data) {
      setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: [...t.players, data] } : t))
    }
    setPlayerName('')
    setPlayerJersey('')
    setPlayerPos('')
    setAddingPlayer(null)
    setSaving(false)
  }

  async function removePlayer(playerId: string, teamId: string) {
    await supabase.from('league_players').delete().eq('id', playerId)
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, players: t.players.filter(p => p.id !== playerId) } : t))
  }

  function copyJoinLink(token: string) {
    const url = `${window.location.origin}/join/${token}`
    navigator.clipboard.writeText(url)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
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
            <button onClick={() => setShowTeamForm(true)} style={S.addBtn}>+ Add Team</button>
          </div>

          {/* Add team form */}
          {showTeamForm && (
            <form onSubmit={addTeam} style={S.inlineForm}>
              <div style={S.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Team Name *</label>
                  <input value={teamName} onChange={e => setTeamName(e.target.value)} style={S.input} placeholder="e.g. Ballers" required autoFocus />
                </div>
                <div>
                  <label style={S.label}>Color</label>
                  <div style={S.colorRow}>
                    {['#39FF14','#FF453A','#FF9500','#4A9EFF','#BF5AF2','#F5C542','#EEEEF5'].map(c => (
                      <button key={c} type="button" onClick={() => setTeamColor(c)}
                        style={{ ...S.colorSwatch, background: c, border: teamColor === c ? `2px solid #fff` : '2px solid transparent' }} />
                    ))}
                  </div>
                </div>
              </div>
              <div style={S.formActions}>
                <button type="button" onClick={() => setShowTeamForm(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.saveBtn} disabled={saving || !teamName}>{saving ? 'Adding…' : 'Add Team'}</button>
              </div>
            </form>
          )}

          {teams.length === 0 && !showTeamForm && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>👥</div>
              <p style={S.emptyText}>No teams yet. Add your first team to get started.</p>
            </div>
          )}

          {/* Team list */}
          <div style={S.teamList}>
            {teams.map(team => (
              <div key={team.id} style={S.teamCard}>
                {/* Team header */}
                <div style={S.teamHeader} onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                  <div style={S.teamLeft}>
                    <div style={{ ...S.teamDot, background: team.color, boxShadow: `0 0 8px ${team.color}66` }} />
                    <div>
                      <div style={S.teamName}>{team.name}</div>
                      <div style={S.teamCount}>{team.players.length} player{team.players.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div style={S.teamRight}>
                    <button
                      onClick={e => { e.stopPropagation(); copyJoinLink(team.join_token) }}
                      style={S.shareBtn}
                      title="Copy join link for captain to share"
                    >
                      {copied === team.join_token ? '✓ Copied!' : '🔗 Share Link'}
                    </button>
                    <span style={S.chevron}>{expandedTeam === team.id ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Roster */}
                {expandedTeam === team.id && (
                  <div style={S.roster}>
                    {team.players.length > 0 && (
                      <table style={S.table}>
                        <thead>
                          <tr>
                            {['#', 'Player', 'Pos', 'Status', ''].map(h => (
                              <th key={h} style={S.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {team.players.map(p => (
                            <tr key={p.id} style={S.tr}>
                              <td style={S.td}><span style={S.jerseyNum}>{p.jersey_number ?? '—'}</span></td>
                              <td style={S.td}>
                                <span style={S.playerName}>{p.display_name}</span>
                                {p.profile_id && <span style={S.linkedBadge}>NETR</span>}
                              </td>
                              <td style={S.td}><span style={S.pos}>{p.position ?? '—'}</span></td>
                              <td style={S.td}>
                                <span style={{ ...S.claimBadge, background: p.is_claimed ? 'rgba(57,255,20,0.12)' : 'rgba(245,197,66,0.12)', color: p.is_claimed ? '#39FF14' : '#F5C542' }}>
                                  {p.is_claimed ? 'Claimed' : 'Unclaimed'}
                                </span>
                              </td>
                              <td style={S.td}>
                                <button onClick={() => removePlayer(p.id, team.id)} style={S.removeBtn} title="Remove player">×</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}

                    {/* Add player inline form */}
                    {addingPlayer === team.id ? (
                      <form onSubmit={e => addPlayer(e, team.id)} style={S.playerForm}>
                        <div style={S.playerFormRow}>
                          <input value={playerName} onChange={e => setPlayerName(e.target.value)} style={{ ...S.input, flex: 2, marginBottom: 0 }} placeholder="Player name *" required autoFocus />
                          <input value={playerJersey} onChange={e => setPlayerJersey(e.target.value)} style={{ ...S.input, flex: '0 0 70px', marginBottom: 0 }} placeholder="#" maxLength={3} />
                          <select value={playerPos} onChange={e => setPlayerPos(e.target.value)} style={{ ...S.input, flex: '0 0 100px', marginBottom: 0 }}>
                            <option value="">Pos</option>
                            {['PG','SG','SF','PF','C'].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
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
  main: { maxWidth: 1200, margin: '0 auto', padding: '40px 24px' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 16 },
  title: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, marginBottom: 4 },
  sub: { color: '#6A6A82', fontSize: 14 },
  addBtn: { background: 'linear-gradient(135deg, #39FF14, #00CC2A)', border: 'none', borderRadius: 8, color: '#040406', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' as const, padding: '10px 20px', cursor: 'pointer' },
  inlineForm: { background: '#0F0F14', border: '1px solid #39FF1444', borderRadius: 12, padding: 24, marginBottom: 20 },
  formRow: { display: 'flex', gap: 20, flexWrap: 'wrap' as const, alignItems: 'flex-end', marginBottom: 16 },
  label: { display: 'block', fontSize: 11, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, marginBottom: 8 },
  input: { background: '#0A0A0D', border: '1px solid #1C1C26', borderRadius: 8, color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 14px', outline: 'none', width: '100%', boxSizing: 'border-box' as const, marginBottom: 0 },
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
  teamDot: { width: 14, height: 14, borderRadius: '50%', flexShrink: 0 },
  teamName: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 20, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  teamCount: { fontSize: 12, color: '#6A6A82' },
  teamRight: { display: 'flex', alignItems: 'center', gap: 12 },
  shareBtn: { background: '#1C1C26', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace", padding: '6px 12px', cursor: 'pointer', whiteSpace: 'nowrap' as const },
  chevron: { color: '#6A6A82', fontSize: 12, fontFamily: "'DM Mono', monospace" },
  roster: { borderTop: '1px solid #1C1C26', padding: '16px 20px 20px' },
  table: { width: '100%', borderCollapse: 'collapse' as const, marginBottom: 14 },
  th: { textAlign: 'left' as const, fontSize: 10, color: '#6A6A82', textTransform: 'uppercase' as const, letterSpacing: 2, fontFamily: "'DM Mono', monospace", padding: '0 12px 10px 0', fontWeight: 400 },
  tr: { borderBottom: '1px solid #14141C' },
  td: { padding: '10px 12px 10px 0', fontSize: 14 },
  jerseyNum: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 13 },
  playerName: { fontWeight: 500 },
  linkedBadge: { marginLeft: 8, background: 'rgba(57,255,20,0.12)', color: '#39FF14', fontSize: 10, fontFamily: "'DM Mono', monospace", padding: '2px 7px', borderRadius: 99, letterSpacing: 0.5 },
  pos: { fontFamily: "'DM Mono', monospace", color: '#6A6A82', fontSize: 12 },
  claimBadge: { fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '2px 8px', borderRadius: 99, letterSpacing: 0.5 },
  removeBtn: { background: 'none', border: 'none', color: '#FF4545', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' },
  playerForm: { marginTop: 8 },
  playerFormRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const },
  addPlayerBtn: { background: 'none', border: '1px dashed #2E2E3A', borderRadius: 8, color: '#6A6A82', fontSize: 13, padding: '8px 16px', cursor: 'pointer', width: '100%', textAlign: 'left' as const, marginTop: 4 },
}
