import Head from 'next/head'
import { useState } from 'react'

const SQL = `-- ============================================================
-- NETR League Dashboard — Table Migration
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. LEAGUES
create table if not exists leagues (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  slug         text unique not null,
  sport        text not null default 'basketball',
  season       text,
  location     text,
  description  text,
  logo_url     text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- 2. LEAGUE TEAMS
create table if not exists league_teams (
  id           uuid primary key default gen_random_uuid(),
  league_id    uuid not null references leagues(id) on delete cascade,
  name         text not null,
  color        text not null default '#39FF14',
  logo_url     text,
  join_token   text unique not null default encode(gen_random_bytes(12), 'hex'),
  created_at   timestamptz not null default now()
);

-- 3. LEAGUE PLAYERS
create table if not exists league_players (
  id             uuid primary key default gen_random_uuid(),
  team_id        uuid not null references league_teams(id) on delete cascade,
  league_id      uuid not null references leagues(id) on delete cascade,
  profile_id     uuid references profiles(id),
  display_name   text not null,
  jersey_number  text,
  position       text,
  is_claimed     boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists league_players_profile_idx on league_players(profile_id);
create index if not exists league_players_team_idx on league_players(team_id);

-- 4. LEAGUE GAMES
create table if not exists league_games (
  id             uuid primary key default gen_random_uuid(),
  league_id      uuid not null references leagues(id) on delete cascade,
  home_team_id   uuid not null references league_teams(id),
  away_team_id   uuid not null references league_teams(id),
  scheduled_at   timestamptz not null,
  location       text,
  status         text not null default 'scheduled'
                   check (status in ('scheduled','final','cancelled')),
  home_score     int,
  away_score     int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists league_games_league_idx on league_games(league_id);

-- 5. LEAGUE PLAYER STATS (box scores)
create table if not exists league_player_stats (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references league_games(id) on delete cascade,
  player_id    uuid not null references league_players(id) on delete cascade,
  team_id      uuid not null references league_teams(id),
  points       int not null default 0,
  rebounds     int not null default 0,
  assists      int not null default 0,
  steals       int not null default 0,
  blocks       int not null default 0,
  turnovers    int not null default 0,
  fouls        int not null default 0,
  unique(game_id, player_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table leagues             enable row level security;
alter table league_teams        enable row level security;
alter table league_players      enable row level security;
alter table league_games        enable row level security;
alter table league_player_stats enable row level security;

-- leagues: owner manages; anyone can read
create policy "leagues_select" on leagues for select using (true);
create policy "leagues_insert" on leagues for insert with check (auth.uid() = owner_id);
create policy "leagues_update" on leagues for update using (auth.uid() = owner_id);
create policy "leagues_delete" on leagues for delete using (auth.uid() = owner_id);

-- league_teams: owner manages via league; anyone reads
create policy "teams_select" on league_teams for select using (true);
create policy "teams_insert" on league_teams for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "teams_update" on league_teams for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "teams_delete" on league_teams for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_players: owner manages; anyone reads
create policy "players_select" on league_players for select using (true);
create policy "players_insert" on league_players for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "players_update" on league_players for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
    or auth.uid() = profile_id
);
create policy "players_delete" on league_players for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_games: owner manages; anyone reads
create policy "games_select" on league_games for select using (true);
create policy "games_insert" on league_games for insert with check (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "games_update" on league_games for update using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);
create policy "games_delete" on league_games for delete using (
  auth.uid() = (select owner_id from leagues where id = league_id)
);

-- league_player_stats: owner manages; anyone reads
create policy "stats_select" on league_player_stats for select using (true);
create policy "stats_insert" on league_player_stats for insert with check (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);
create policy "stats_update" on league_player_stats for update using (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);
create policy "stats_delete" on league_player_stats for delete using (
  auth.uid() = (select owner_id from leagues l
                join league_games g on g.league_id = l.id
                where g.id = game_id)
);

-- ============================================================
-- STANDINGS VIEW
-- Computes W/L/PF/PA from completed games
-- ============================================================
create or replace view league_standings as
select
  t.league_id,
  t.id as team_id,
  t.name as team_name,
  t.color,
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score > g.away_score)
       or (g.away_team_id = t.id and g.away_score > g.home_score)
  ) as wins,
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score < g.away_score)
       or (g.away_team_id = t.id and g.away_score < g.home_score)
  ) as losses,
  coalesce(sum(case when g.home_team_id = t.id then g.home_score
                    when g.away_team_id = t.id then g.away_score end), 0) as pts_for,
  coalesce(sum(case when g.home_team_id = t.id then g.away_score
                    when g.away_team_id = t.id then g.home_score end), 0) as pts_against
from league_teams t
left join league_games g
  on (g.home_team_id = t.id or g.away_team_id = t.id)
  and g.status = 'final'
group by t.league_id, t.id, t.name, t.color
order by
  count(*) filter (
    where (g.home_team_id = t.id and g.home_score > g.away_score)
       or (g.away_team_id = t.id and g.away_score > g.home_score)
  ) desc,
  (
    coalesce(sum(case when g.home_team_id = t.id then g.home_score
                      when g.away_team_id = t.id then g.away_score end), 0) -
    coalesce(sum(case when g.home_team_id = t.id then g.away_score
                      when g.away_team_id = t.id then g.home_score end), 0)
  ) desc;`

export default function SetupPage() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <>
      <Head>
        <title>Database Setup — NETR League Portal</title>
        <meta name="robots" content="noindex, nofollow" />
        <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div style={S.page}>
        <nav style={S.nav}>
          <div style={S.navInner}>
            <a href="/league-portal/login" style={S.backLink}>← League Portal</a>
            <span style={S.logo}>NETR <span style={{ color: '#EEEEF5', opacity: 0.5 }}>SETUP</span></span>
          </div>
        </nav>

        <main style={S.main}>
          <div style={S.glow} />

          <div style={S.header}>
            <div style={S.step}>Step 1 of 2</div>
            <h1 style={S.title}>Database Setup</h1>
            <p style={S.sub}>
              Copy the SQL below and paste it into your{' '}
              <strong style={{ color: '#EEEEF5' }}>Supabase SQL Editor</strong>, then click Run.
              This creates the 5 league tables, sets permissions, and adds the standings view.
            </p>
          </div>

          <div style={S.card}>
            {/* Top bar with copy button */}
            <div style={S.cardHeader}>
              <div style={S.cardLabel}>
                <span style={S.dot} />
                migration.sql
              </div>
              <button onClick={handleCopy} style={{ ...S.copyBtn, ...(copied ? S.copyBtnDone : {}) }}>
                {copied ? '✓ Copied!' : 'Copy SQL'}
              </button>
            </div>

            {/* SQL block */}
            <pre style={S.pre}><code style={S.code}>{SQL}</code></pre>
          </div>

          <div style={S.nextStep}>
            <div style={S.nextLabel}>Step 2 of 2</div>
            <p style={S.nextText}>After running the SQL successfully, create your commissioner account.</p>
            <a href="/league-portal/signup" style={S.nextBtn}>Create Account →</a>
          </div>
        </main>
      </div>
    </>
  )
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#040406',
    fontFamily: "'DM Sans', sans-serif",
    color: '#EEEEF5',
  },
  nav: {
    background: '#0A0A0E',
    borderBottom: '1px solid #1C1C26',
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  },
  navInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '0 24px',
    height: 60,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backLink: {
    color: '#6A6A82',
    fontSize: 13,
    textDecoration: 'none',
    fontFamily: "'DM Mono', monospace",
  },
  logo: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 22,
    color: '#39FF14',
  },
  main: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '48px 24px 80px',
    position: 'relative' as const,
  },
  glow: {
    position: 'absolute' as const,
    width: 600,
    height: 400,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(57,255,20,0.05) 0%, transparent 70%)',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    pointerEvents: 'none' as const,
  },
  header: {
    maxWidth: 640,
    marginBottom: 32,
    position: 'relative' as const,
    zIndex: 1,
  },
  step: {
    fontSize: 11,
    color: '#39FF14',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  title: {
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 900,
    fontSize: 40,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    lineHeight: 1,
  },
  sub: {
    fontSize: 15,
    color: '#6A6A82',
    lineHeight: 1.6,
  },
  card: {
    background: '#0D0D12',
    border: '1px solid #1C1C26',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative' as const,
    zIndex: 1,
    marginBottom: 32,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid #1C1C26',
    background: '#0A0A0E',
  },
  cardLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#39FF14',
    boxShadow: '0 0 6px #39FF1488',
    display: 'inline-block',
  },
  copyBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    border: 'none',
    borderRadius: 8,
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    padding: '8px 20px',
    cursor: 'pointer',
    transition: 'opacity 0.2s',
  },
  copyBtnDone: {
    background: 'rgba(57,255,20,0.15)',
    color: '#39FF14',
  },
  pre: {
    margin: 0,
    padding: '20px 24px',
    overflowX: 'auto' as const,
    maxHeight: 520,
    overflowY: 'auto' as const,
  },
  code: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 12,
    lineHeight: 1.7,
    color: '#A8B8C8',
    whiteSpace: 'pre' as const,
  },
  nextStep: {
    background: '#0F0F14',
    border: '1px solid #1C1C26',
    borderRadius: 14,
    padding: '28px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    flexWrap: 'wrap' as const,
    position: 'relative' as const,
    zIndex: 1,
  },
  nextLabel: {
    fontSize: 11,
    color: '#6A6A82',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  nextText: {
    fontSize: 15,
    color: '#6A6A82',
    flex: 1,
  },
  nextBtn: {
    background: 'linear-gradient(135deg, #39FF14, #00CC2A)',
    color: '#040406',
    fontFamily: "'Barlow Condensed', sans-serif",
    fontWeight: 700,
    fontSize: 17,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    padding: '12px 28px',
    borderRadius: 10,
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
  },
}
