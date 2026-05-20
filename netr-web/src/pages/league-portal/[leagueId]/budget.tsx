import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState, useEffect, useRef } from 'react'
import { supabase, League, LeagueTeam, LeaguePlayerPayment } from '../../../lib/supabase'
import { PortalNav } from './index'

type EntryType = 'income' | 'expense'
type Category =
  | 'team_fee' | 'sponsorship' | 'registration' | 'merchandise' | 'other_income'
  | 'venue' | 'referees' | 'equipment' | 'awards' | 'marketing' | 'insurance' | 'other_expense'

type BudgetEntry = {
  id: string
  type: EntryType
  category: Category
  description: string
  amount: number
  date: string
  notes: string
}

const INCOME_CATEGORIES: { value: Category; label: string }[] = [
  { value: 'team_fee', label: 'Team Registration Fee' },
  { value: 'sponsorship', label: 'Sponsorship' },
  { value: 'registration', label: 'Player Registration' },
  { value: 'merchandise', label: 'Merchandise Sales' },
  { value: 'other_income', label: 'Other Income' },
]
const EXPENSE_CATEGORIES: { value: Category; label: string }[] = [
  { value: 'venue', label: 'Venue / Court Rental' },
  { value: 'referees', label: 'Referees / Officials' },
  { value: 'equipment', label: 'Equipment & Supplies' },
  { value: 'awards', label: 'Awards & Trophies' },
  { value: 'marketing', label: 'Marketing & Promotion' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other_expense', label: 'Other Expense' },
]

const CAT_LABEL: Record<Category, string> = Object.fromEntries([
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
].map(c => [c.value, c.label])) as Record<Category, string>

const EMPTY_FORM = {
  type: 'income' as EntryType,
  category: 'team_fee' as Category,
  description: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  notes: '',
}

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function BudgetPage() {
  const router = useRouter()
  const { leagueId } = router.query as { leagueId: string }
  const [league, setLeague] = useState<League | null>(null)
  const [teams, setTeams] = useState<LeagueTeam[]>([])
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<BudgetEntry[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [savingFee, setSavingFee] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Stripe Connect state
  const [stripeConnected, setStripeConnected] = useState(false)
  const [stripeComplete, setStripeComplete] = useState(false)
  const [connectingStripe, setConnectingStripe] = useState(false)
  const [payModes, setPayModes] = useState<string[]>([])
  const [installCount, setInstallCount] = useState(3)
  const [installInterval, setInstallInterval] = useState('month')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null)
  const [playerPayments, setPlayerPayments] = useState<Record<string, LeaguePlayerPayment[]>>({})

  const storageKey = leagueId ? `budget_entries_${leagueId}` : null

  useEffect(() => {
    if (!leagueId) return
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/league-portal/login'); return }
      const [leagueRes, teamsRes] = await Promise.all([
        supabase.from('leagues').select('*').eq('id', leagueId).eq('owner_id', user.id).single(),
        supabase.from('league_teams').select('*').eq('league_id', leagueId).order('name'),
      ])
      if (!leagueRes.data) { router.replace('/league-portal'); return }
      setLeague(leagueRes.data)
      setTeams(teamsRes.data ?? [])

      // Stripe config
      const l = leagueRes.data
      setStripeConnected(!!l.stripe_account_id)
      setStripeComplete(l.stripe_onboarding_complete ?? false)
      setPayModes(l.payment_modes_enabled ?? [])
      setInstallCount(l.installment_count ?? 3)
      setInstallInterval(l.installment_interval ?? 'month')

      // Load per-player payments for split-mode teams
      const teamIds = (teamsRes.data ?? []).map((t: LeagueTeam) => t.id)
      if (teamIds.length > 0) {
        const { data: pp } = await supabase
          .from('league_player_payments')
          .select('*')
          .in('team_id', teamIds)
        if (pp) {
          const grouped: Record<string, LeaguePlayerPayment[]> = {}
          for (const row of pp as LeaguePlayerPayment[]) {
            if (!grouped[row.team_id]) grouped[row.team_id] = []
            grouped[row.team_id].push(row)
          }
          setPlayerPayments(grouped)
        }
      }

      const stored = localStorage.getItem(`budget_entries_${leagueId}`)
      if (stored) {
        try { setEntries(JSON.parse(stored)) } catch {}
      }
      setLoading(false)
    })
  }, [leagueId])

  // Verify Stripe onboarding when returning from Stripe dashboard
  useEffect(() => {
    if (!leagueId || !router.query.stripe_return || loading) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) return
      const res = await fetch(`/api/stripe/connect/status?leagueId=${leagueId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        const d = await res.json()
        setStripeConnected(d.connected)
        setStripeComplete(d.complete)
        if (d.complete) {
          await supabase.from('leagues').update({ stripe_onboarding_complete: true }).eq('id', leagueId)
        }
      }
      // Clean the query param without full reload
      router.replace(`/league-portal/${leagueId}/budget`, undefined, { shallow: true })
    })
  }, [leagueId, router.query.stripe_return, loading])

  function saveEntries(next: BudgetEntry[]) {
    setEntries(next)
    if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next))
  }

  async function toggleFeePaid(team: LeagueTeam) {
    setSavingFee(team.id)
    await supabase.from('league_teams').update({ fee_paid: !team.fee_paid }).eq('id', team.id)
    setTeams(prev => prev.map(t => t.id === team.id ? { ...t, fee_paid: !t.fee_paid } : t))
    setSavingFee(null)
  }

  async function connectStripe() {
    setConnectingStripe(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/stripe/connect/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ leagueId }),
    })
    const d = await res.json()
    if (d.url) window.location.href = d.url
    else setConnectingStripe(false)
  }

  async function savePaymentConfig() {
    setSavingConfig(true)
    await supabase.from('leagues').update({
      payment_modes_enabled: payModes,
      installment_count: installCount,
      installment_interval: installInterval,
    }).eq('id', leagueId)
    setSavingConfig(false)
    setConfigSaved(true)
    setTimeout(() => setConfigSaved(false), 2500)
  }

  function togglePayMode(mode: string) {
    setPayModes(prev => prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode])
    setConfigSaved(false)
  }

  function copyPayLink(teamId: string) {
    const url = `${window.location.origin}/pay/${leagueId}/${teamId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopiedTeamId(teamId)
      setTimeout(() => setCopiedTeamId(null), 2000)
    })
  }

  function openAdd() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function openEdit(entry: BudgetEntry) {
    setEditId(entry.id)
    setForm({ type: entry.type, category: entry.category, description: entry.description, amount: String(entry.amount), date: entry.date, notes: entry.notes })
    setShowForm(true)
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function submitEntry(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseFloat(form.amount)
    if (!form.description.trim() || isNaN(amt) || amt <= 0) return
    const entry: BudgetEntry = {
      id: editId ?? genId(),
      type: form.type,
      category: form.category,
      description: form.description.trim(),
      amount: amt,
      date: form.date,
      notes: form.notes.trim(),
    }
    if (editId) {
      saveEntries(entries.map(e => e.id === editId ? entry : e))
    } else {
      saveEntries([...entries, entry].sort((a, b) => b.date.localeCompare(a.date)))
    }
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function deleteEntry(id: string) {
    saveEntries(entries.filter(e => e.id !== id))
    setDeleteConfirm(null)
  }

  function exportCsv() {
    if (!league) return
    const rows = [
      ['Date', 'Type', 'Category', 'Description', 'Amount', 'Notes'],
      ...entries.map(e => [
        e.date,
        e.type,
        CAT_LABEL[e.category],
        e.description,
        e.type === 'income' ? e.amount.toFixed(2) : (-e.amount).toFixed(2),
        e.notes,
      ]),
      [],
      ['', '', '', 'Total Income', totalIncome.toFixed(2), ''],
      ['', '', '', 'Total Expenses', totalExpenses.toFixed(2), ''],
      ['', '', '', 'Net Balance', netBalance.toFixed(2), ''],
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${league.name.replace(/\s+/g, '-')}-budget.csv`
    a.click()
  }

  if (loading || !league) return <LoadingScreen />

  const paidTeams = teams.filter(t => t.fee_paid)
  const unpaidTeams = teams.filter(t => !t.fee_paid)
  const feeIncome = paidTeams.length * (league.fee_amount ?? 0)
  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0) + feeIncome
  const totalExpenses = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0)
  const netBalance = totalIncome - totalExpenses
  const accentColor = league.accent_color ?? '#39FF14'

  const incomeEntries = entries.filter(e => e.type === 'income').sort((a, b) => b.date.localeCompare(a.date))
  const expenseEntries = entries.filter(e => e.type === 'expense').sort((a, b) => b.date.localeCompare(a.date))

  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      <Head>
        <title>Budget — {league.name} — NETR</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <PortalNav leagueName={league.name} leagueId={leagueId} active="budget" logoUrl={league.logo_url} />

        <main style={S.main}>
          {/* Header */}
          <div style={S.pageHeader}>
            <div>
              <h1 style={S.pageTitle}>Budget & Payments</h1>
              <p style={S.pageSubtitle}>Track income, expenses, and team fee collection</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={exportCsv} style={S.exportBtn}>⬇ Export CSV</button>
              <button onClick={openAdd} style={{ ...S.addBtn, background: `linear-gradient(135deg, ${accentColor}, ${accentColor}BB)` }}>+ Add Entry</button>
            </div>
          </div>

          {/* ── Stripe Connect banner ── */}
          {!stripeComplete ? (
            <div style={{ ...S.stripeCard, borderColor: stripeConnected ? 'rgba(245,197,66,0.35)' : 'rgba(57,255,20,0.2)' }}>
              <div style={S.stripeCardLeft}>
                <div style={S.stripeIcon}>{stripeConnected ? '⏳' : '💳'}</div>
                <div>
                  <div style={S.stripeTitle}>
                    {stripeConnected ? 'Finish connecting Stripe' : 'Accept online payments'}
                  </div>
                  <div style={S.stripeSub}>
                    {stripeConnected
                      ? 'Your Stripe account was created but onboarding is not complete yet. Click to finish.'
                      : 'Connect your Stripe account so captains and players can pay you directly. NETR takes 0%.'}
                  </div>
                </div>
              </div>
              <button
                onClick={connectStripe}
                disabled={connectingStripe}
                style={{ ...S.stripeBtn, opacity: connectingStripe ? 0.6 : 1, background: accentColor, color: '#040406' }}
              >
                {connectingStripe ? 'Redirecting…' : stripeConnected ? 'Finish Setup →' : 'Connect Stripe →'}
              </button>
            </div>
          ) : (
            <div style={{ ...S.stripeCard, borderColor: 'rgba(57,255,20,0.3)', background: 'rgba(57,255,20,0.04)' }}>
              <div style={S.stripeCardLeft}>
                <div style={S.stripeIcon}>✅</div>
                <div>
                  <div style={S.stripeTitle}>Stripe connected</div>
                  <div style={S.stripeSub}>Payments go directly to your Stripe account. NETR takes nothing.</div>
                </div>
              </div>
              <button onClick={connectStripe} disabled={connectingStripe} style={S.stripeLinkBtn}>
                {connectingStripe ? '…' : 'Manage account ↗'}
              </button>
            </div>
          )}

          {/* ── Payment mode config (only when Stripe connected) ── */}
          {stripeComplete && league.fee_amount && (
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitle}>⚙️ Payment Options</div>
                <div style={S.sectionMeta}>Configure how teams can pay</div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, marginBottom: 20 }}>
                  {[
                    { key: 'full', label: '💳 Pay in Full', desc: `One payment of $${league.fee_amount.toLocaleString()}` },
                    { key: 'split', label: '👥 Player Split', desc: 'Each player pays their share' },
                    { key: 'plan', label: '📅 Payment Plan', desc: 'Monthly installments' },
                  ].map(m => (
                    <label key={m.key} style={{ ...S.modeToggle, borderColor: payModes.includes(m.key) ? accentColor : '#2E2E3A', background: payModes.includes(m.key) ? `${accentColor}12` : '#14141C', cursor: 'pointer' }}>
                      <input type="checkbox" checked={payModes.includes(m.key)} onChange={() => togglePayMode(m.key)} style={{ display: 'none' }} />
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, textTransform: 'uppercase' as const, letterSpacing: 0.5, color: payModes.includes(m.key) ? accentColor : '#EEEEF5' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{m.desc}</div>
                    </label>
                  ))}
                </div>

                {payModes.includes('plan') && (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' as const }}>
                    <div style={{ fontSize: 13, color: '#6A6A82' }}>Plan: </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="number" min={2} max={24} value={installCount}
                        onChange={e => { setInstallCount(Number(e.target.value)); setConfigSaved(false) }}
                        style={{ ...S.smallInput, width: 64 }}
                      />
                      <span style={{ fontSize: 13, color: '#6A6A82' }}>payments of</span>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: accentColor }}>
                        ${(Math.round((league.fee_amount * 100) / installCount) / 100).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 13, color: '#6A6A82' }}>per</span>
                      <select value={installInterval} onChange={e => { setInstallInterval(e.target.value); setConfigSaved(false) }} style={S.smallSelect}>
                        <option value="month">month</option>
                        <option value="week">week</option>
                      </select>
                    </div>
                  </div>
                )}

                <button onClick={savePaymentConfig} disabled={savingConfig} style={{ ...S.saveConfigBtn, background: configSaved ? 'rgba(57,255,20,0.15)' : accentColor, color: configSaved ? '#39FF14' : '#040406', border: configSaved ? '1px solid rgba(57,255,20,0.4)' : 'none' }}>
                  {savingConfig ? 'Saving…' : configSaved ? '✓ Saved' : 'Save Payment Settings'}
                </button>
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div style={S.summaryRow}>
            <div style={{ ...S.summaryCard, borderColor: 'rgba(57,255,20,0.3)' }}>
              <div style={S.summaryIcon}>💰</div>
              <div>
                <div style={{ ...S.summaryVal, color: '#39FF14' }}>${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style={S.summaryLabel}>Total Income</div>
              </div>
            </div>
            <div style={{ ...S.summaryCard, borderColor: 'rgba(255,69,58,0.3)' }}>
              <div style={S.summaryIcon}>📤</div>
              <div>
                <div style={{ ...S.summaryVal, color: '#FF453A' }}>${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style={S.summaryLabel}>Total Expenses</div>
              </div>
            </div>
            <div style={{ ...S.summaryCard, borderColor: netBalance >= 0 ? 'rgba(57,255,20,0.3)' : 'rgba(255,69,58,0.3)' }}>
              <div style={S.summaryIcon}>{netBalance >= 0 ? '📈' : '📉'}</div>
              <div>
                <div style={{ ...S.summaryVal, color: netBalance >= 0 ? '#39FF14' : '#FF453A' }}>
                  {netBalance < 0 ? '-' : ''}${Math.abs(netBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div style={S.summaryLabel}>Net Balance</div>
              </div>
            </div>
            {league.fee_amount ? (
              <div style={{ ...S.summaryCard, borderColor: 'rgba(191,90,242,0.3)' }}>
                <div style={S.summaryIcon}>🏀</div>
                <div>
                  <div style={{ ...S.summaryVal, color: '#BF5AF2' }}>{paidTeams.length}/{teams.length}</div>
                  <div style={S.summaryLabel}>Teams Paid</div>
                  <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
                    ${feeIncome.toLocaleString()} / ${(teams.length * league.fee_amount).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Team Fee Tracker */}
          {league.fee_amount ? (
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={S.sectionTitle}>🏀 Team Fee Collection</div>
                <div style={S.sectionMeta}>${league.fee_amount.toLocaleString()} per team · {unpaidTeams.length > 0 ? `${unpaidTeams.length} unpaid` : 'All paid ✓'}</div>
              </div>
              <div style={S.teamGrid}>
                {teams.map(team => {
                  const pp = playerPayments[team.id] ?? []
                  const paidPlayers = pp.filter(p => p.paid_at).length
                  const isPlan = team.payment_mode === 'plan'
                  const isSplit = team.payment_mode === 'split'
                  return (
                    <div key={team.id} style={{ ...S.teamCard, borderColor: team.fee_paid ? 'rgba(57,255,20,0.3)' : '#1C1C26' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: team.color, flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={S.teamName}>{team.name}</div>
                          {isPlan && !team.fee_paid && (
                            <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                              Plan: {team.installments_paid ?? 0}/{team.installments_total ?? installCount} payments
                            </div>
                          )}
                          {isSplit && !team.fee_paid && pp.length > 0 && (
                            <div style={{ fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                              {paidPlayers}/{pp.length} players paid
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ ...S.paidBadge, background: team.fee_paid ? 'rgba(57,255,20,0.12)' : 'rgba(255,69,58,0.1)', color: team.fee_paid ? '#39FF14' : '#FF453A', borderColor: team.fee_paid ? 'rgba(57,255,20,0.3)' : 'rgba(255,69,58,0.3)' }}>
                          {team.fee_paid ? '✓ Paid' : '✗ Unpaid'}
                        </span>
                        {/* Pay link (only if Stripe connected and modes configured) */}
                        {stripeComplete && payModes.length > 0 && !team.fee_paid && (
                          <button
                            onClick={() => copyPayLink(team.id)}
                            style={{ ...S.toggleBtn, color: copiedTeamId === team.id ? '#39FF14' : '#EEEEF5', borderColor: copiedTeamId === team.id ? 'rgba(57,255,20,0.4)' : '#2E2E3A' }}
                          >
                            {copiedTeamId === team.id ? '✓ Copied!' : '🔗 Copy link'}
                          </button>
                        )}
                        <button
                          onClick={() => toggleFeePaid(team)}
                          disabled={savingFee === team.id}
                          style={{ ...S.toggleBtn, opacity: savingFee === team.id ? 0.5 : 1 }}
                        >
                          {savingFee === team.id ? '…' : team.fee_paid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {stripeComplete && payModes.length > 0 && (
                <div style={{ padding: '12px 18px', borderTop: '1px solid #14141C', fontSize: 12, color: '#6A6A82', fontFamily: "'DM Mono', monospace" }}>
                  💡 "Copy link" sends teams to their Stripe payment page · payments mark automatically
                </div>
              )}
            </div>
          ) : null}

          {/* Add/Edit form */}
          {showForm && (
            <div ref={formRef} style={S.formCard}>
              <div style={S.formHeader}>
                <span style={S.formTitle}>{editId ? 'Edit Entry' : 'Add Budget Entry'}</span>
                <button onClick={() => { setShowForm(false); setEditId(null) }} style={S.closeBtn}>✕</button>
              </div>
              <form onSubmit={submitEntry}>
                {/* Type toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {(['income', 'expense'] as EntryType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: t, category: t === 'income' ? 'team_fee' : 'venue' }))}
                      style={{ ...S.typeBtn, ...(form.type === t ? (t === 'income' ? S.typeBtnIncome : S.typeBtnExpense) : {}) }}
                    >
                      {t === 'income' ? '+ Income' : '− Expense'}
                    </button>
                  ))}
                </div>

                <div style={S.formGrid}>
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                      style={S.select}
                    >
                      {(form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Date</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                      style={S.input}
                      required
                    />
                  </div>
                  <div style={{ ...S.fieldGroup, gridColumn: '1 / -1' }}>
                    <label style={S.label}>Description *</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder={form.type === 'income' ? 'e.g., Spring 2025 — Thunder Hawks registration' : 'e.g., Miller Park gym rental — April'}
                      style={S.input}
                      required
                    />
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Amount ($) *</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amount}
                      onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      style={S.input}
                      required
                    />
                  </div>
                  <div style={S.fieldGroup}>
                    <label style={S.label}>Notes (optional)</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      placeholder="Any additional details"
                      style={S.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <button type="submit" style={{ ...S.submitBtn, background: form.type === 'income' ? 'linear-gradient(135deg, #39FF14, #00CC2A)' : 'linear-gradient(135deg, #FF453A, #CC1A10)' }}>
                    {editId ? 'Update Entry' : `Add ${form.type === 'income' ? 'Income' : 'Expense'}`}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setEditId(null) }} style={S.cancelBtn}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Ledger */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {/* Income */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={{ ...S.sectionTitle, color: '#39FF14' }}>↑ Income</div>
                <div style={{ ...S.sectionMeta, color: '#39FF14' }}>${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>

              {/* Auto fee rows */}
              {league.fee_amount && paidTeams.length > 0 && (
                <div style={S.autoRow}>
                  <div style={S.autoRowLeft}>
                    <span style={catDot('income')} />
                    <div>
                      <div style={S.entryDesc}>Team Registration Fees</div>
                      <div style={S.entryMeta}>Auto-calculated · {paidTeams.length} teams × ${league.fee_amount.toLocaleString()}</div>
                    </div>
                  </div>
                  <div style={{ ...S.entryAmt, color: '#39FF14' }}>+${feeIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                </div>
              )}

              {incomeEntries.length === 0 && !feeIncome ? (
                <div style={S.emptyState}>No income entries yet. <button onClick={openAdd} style={S.emptyBtn}>Add one →</button></div>
              ) : (
                incomeEntries.map(entry => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => setDeleteConfirm(entry.id)}
                    deleteConfirm={deleteConfirm === entry.id}
                    onConfirmDelete={() => deleteEntry(entry.id)}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    fmtDate={fmtDate}
                  />
                ))
              )}
            </div>

            {/* Expenses */}
            <div style={S.section}>
              <div style={S.sectionHeader}>
                <div style={{ ...S.sectionTitle, color: '#FF453A' }}>↓ Expenses</div>
                <div style={{ ...S.sectionMeta, color: '#FF453A' }}>${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              </div>

              {expenseEntries.length === 0 ? (
                <div style={S.emptyState}>No expense entries yet. <button onClick={openAdd} style={S.emptyBtn}>Add one →</button></div>
              ) : (
                expenseEntries.map(entry => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => setDeleteConfirm(entry.id)}
                    deleteConfirm={deleteConfirm === entry.id}
                    onConfirmDelete={() => deleteEntry(entry.id)}
                    onCancelDelete={() => setDeleteConfirm(null)}
                    fmtDate={fmtDate}
                  />
                ))
              )}
            </div>
          </div>

          {/* Bottom note */}
          <div style={S.storageNote}>
            💾 Budget entries are stored locally in your browser. Export to CSV to save a permanent record.
          </div>
        </main>
      </div>
    </>
  )
}

function EntryRow({ entry, onEdit, onDelete, deleteConfirm, onConfirmDelete, onCancelDelete, fmtDate }: {
  entry: BudgetEntry
  onEdit: () => void
  onDelete: () => void
  deleteConfirm: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
  fmtDate: (d: string) => string
}) {
  const isIncome = entry.type === 'income'
  return (
    <div style={S.entryRow}>
      <div style={S.entryLeft}>
        <span style={catDot(entry.type)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.entryDesc}>{entry.description}</div>
          <div style={S.entryMeta}>{CAT_LABEL[entry.category]} · {fmtDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ ...S.entryAmt, color: isIncome ? '#39FF14' : '#FF453A' }}>
          {isIncome ? '+' : '−'}${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </div>
        {deleteConfirm ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onConfirmDelete} style={S.delConfirmBtn}>Delete</button>
            <button onClick={onCancelDelete} style={S.cancelSmBtn}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={onEdit} style={S.iconBtn} title="Edit">✏</button>
            <button onClick={onDelete} style={S.iconBtn} title="Delete">🗑</button>
          </div>
        )}
      </div>
    </div>
  )
}

function catDot(type: EntryType): React.CSSProperties {
  return {
    width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
    background: type === 'income' ? '#39FF14' : '#FF453A',
  }
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
  main: { maxWidth: 1100, margin: '0 auto', padding: '32px 24px 80px' },

  pageHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap' as const, gap: 16 },
  pageTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, textTransform: 'uppercase' as const, letterSpacing: 1, margin: 0, color: '#EEEEF5' },
  pageSubtitle: { color: '#6A6A82', fontSize: 14, marginTop: 4, fontFamily: "'DM Sans', sans-serif" },

  exportBtn: {
    background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 8, color: '#EEEEF5',
    fontFamily: "'DM Mono', monospace", fontSize: 13, padding: '9px 16px', cursor: 'pointer',
  },
  addBtn: {
    border: 'none', borderRadius: 8, color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 16,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '9px 20px', cursor: 'pointer',
  },

  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 },
  summaryCard: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, padding: '20px 20px', display: 'flex', alignItems: 'center', gap: 14 },
  summaryIcon: { fontSize: 28, flexShrink: 0 },
  summaryVal: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 26, lineHeight: 1 },
  summaryLabel: { fontSize: 12, color: '#6A6A82', marginTop: 4 },

  section: { background: '#0F0F14', border: '1px solid #1C1C26', borderRadius: 14, overflow: 'hidden', marginBottom: 20 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #1C1C26', background: '#0A0A0E' },
  sectionTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sectionMeta: { fontSize: 13, color: '#6A6A82', fontFamily: "'DM Mono', monospace" },

  teamGrid: { padding: 12, display: 'flex', flexDirection: 'column' as const, gap: 6 },
  teamCard: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#14141C', borderRadius: 10, border: '1px solid #1C1C26' },
  teamName: { fontSize: 14, fontWeight: 500 },
  paidBadge: { fontSize: 11, fontFamily: "'DM Mono', monospace", padding: '3px 10px', borderRadius: 99, border: '1px solid' },
  toggleBtn: {
    background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 6,
    color: '#EEEEF5', fontSize: 12, fontFamily: "'DM Mono', monospace",
    padding: '4px 10px', cursor: 'pointer',
  },

  // Stripe Connect styles
  stripeCard: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
    background: '#0A0A0E', border: '1px solid', borderRadius: 14, padding: '18px 22px',
    marginBottom: 20, flexWrap: 'wrap' as const,
  },
  stripeCardLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: 1 },
  stripeIcon: { fontSize: 28, flexShrink: 0 },
  stripeTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 2 },
  stripeSub: { fontSize: 13, color: '#6A6A82', maxWidth: 480 },
  stripeBtn: {
    border: 'none', borderRadius: 8, padding: '10px 20px',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, cursor: 'pointer', flexShrink: 0,
  },
  stripeLinkBtn: {
    background: 'transparent', border: '1px solid #2E2E3A', borderRadius: 8, padding: '8px 16px',
    color: '#6A6A82', fontSize: 13, fontFamily: "'DM Mono', monospace", cursor: 'pointer', flexShrink: 0,
  },
  modeToggle: {
    border: '1px solid', borderRadius: 10, padding: '12px 16px', minWidth: 160,
    display: 'flex', flexDirection: 'column' as const,
  },
  saveConfigBtn: {
    border: 'none', borderRadius: 8, padding: '10px 20px',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, cursor: 'pointer',
  },
  smallInput: {
    background: '#0A0A0D', border: '1px solid #2E2E3A', borderRadius: 6,
    color: '#EEEEF5', fontFamily: "'DM Mono', monospace", fontSize: 13, padding: '6px 10px',
    outline: 'none', textAlign: 'center' as const,
  },
  smallSelect: {
    background: '#0A0A0D', border: '1px solid #2E2E3A', borderRadius: 6,
    color: '#EEEEF5', fontFamily: "'DM Mono', monospace", fontSize: 13, padding: '6px 10px',
    outline: 'none',
  },

  formCard: { background: '#0F0F14', border: '1px solid #2E2E3A', borderRadius: 14, padding: '24px', marginBottom: 24 },
  formHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  formTitle: { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 22, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  closeBtn: { background: 'transparent', border: 'none', color: '#6A6A82', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4 },
  typeBtn: {
    flex: 1, padding: '10px 0', border: '1px solid #2E2E3A', borderRadius: 8, background: '#14141C',
    color: '#6A6A82', fontSize: 15, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, cursor: 'pointer',
  },
  typeBtnIncome: { background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.4)', color: '#39FF14' },
  typeBtnExpense: { background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.4)', color: '#FF453A' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fieldGroup: {},
  label: { display: 'block', fontSize: 11, color: '#6A6A82', fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
  input: {
    width: '100%', background: '#0A0A0D', border: '1px solid #2E2E3A', borderRadius: 8,
    color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 12px',
    outline: 'none', boxSizing: 'border-box' as const,
  },
  select: {
    width: '100%', background: '#0A0A0D', border: '1px solid #2E2E3A', borderRadius: 8,
    color: '#EEEEF5', fontFamily: "'DM Sans', sans-serif", fontSize: 14, padding: '10px 12px',
    outline: 'none', boxSizing: 'border-box' as const, appearance: 'none' as const,
  },
  submitBtn: {
    flex: 1, border: 'none', borderRadius: 8, color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, padding: '12px 24px', cursor: 'pointer',
  },
  cancelBtn: {
    border: '1px solid #2E2E3A', borderRadius: 8, background: 'transparent',
    color: '#6A6A82', fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    padding: '12px 20px', cursor: 'pointer',
  },

  autoRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #14141C', background: 'rgba(57,255,20,0.03)' },
  autoRowLeft: { display: 'flex', gap: 10, flex: 1, minWidth: 0 },
  entryRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid #14141C' },
  entryLeft: { display: 'flex', gap: 10, flex: 1, minWidth: 0, marginRight: 12 },
  entryDesc: { fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  entryMeta: { fontSize: 12, color: '#6A6A82', marginTop: 2 },
  entryAmt: { fontFamily: "'DM Mono', monospace", fontWeight: 500, fontSize: 14, whiteSpace: 'nowrap' as const },
  iconBtn: { background: 'transparent', border: 'none', color: '#6A6A82', fontSize: 14, cursor: 'pointer', padding: '2px 4px' },
  delConfirmBtn: { background: 'rgba(255,69,58,0.15)', border: '1px solid rgba(255,69,58,0.4)', color: '#FF453A', fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  cancelSmBtn: { background: 'transparent', border: '1px solid #2E2E3A', color: '#6A6A82', fontSize: 11, borderRadius: 6, padding: '4px 10px', cursor: 'pointer' },
  emptyState: { padding: '24px 18px', color: '#6A6A82', fontSize: 14 },
  emptyBtn: { background: 'transparent', border: 'none', color: '#39FF14', fontSize: 14, cursor: 'pointer', padding: 0, textDecoration: 'underline' as const },
  storageNote: { textAlign: 'center' as const, color: '#3A3A50', fontSize: 12, fontFamily: "'DM Mono', monospace", marginTop: 20 },
}
