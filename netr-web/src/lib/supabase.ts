import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(url, anonKey)

export async function fetchAllCourts(): Promise<{ id: string; name: string; city: string }[]> {
  const pageSize = 1000
  const all: { id: string; name: string; city: string }[] = []
  let offset = 0

  while (true) {
    const res = await fetch(
      `${url}/rest/v1/courts?select=id,name,city&order=name&limit=${pageSize}&offset=${offset}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Range-Unit': 'items',
          Range: `${offset}-${offset + pageSize - 1}`,
          Prefer: 'count=none',
        },
      }
    )
    if (!res.ok) break
    const page: { id: string; name: string; city: string }[] = await res.json()
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

export type League = {
  id: string
  owner_id: string
  name: string
  slug: string
  sport: string
  season: string | null
  location: string | null
  description: string | null
  logo_url: string | null
  is_active: boolean
  enabled_stats: string[] | null
  min_games_for_stats: number | null
  default_game_location: string | null
  stat_display: 'per_game' | 'totals' | null
  games_per_team: number | null
  playoff_teams: number | null
  playoff_format: string | null
  fee_amount: number | null
  banner_url: string | null
  accent_color: string | null
  announcement: string | null
  contact_info: string | null
  social_links: Record<string, string> | null
  custom_domain: string | null
  custom_domain_status: 'pending' | 'active' | 'error' | null
  default_court_id: string | null
  league_font: string | null
  signup_url: string | null
  signup_label: string | null
  cross_division_play: boolean
  created_at: string
}

export type LeagueDivision = {
  id: string
  league_id: string
  name: string
  display_order: number
  created_at: string
}

export type LeagueSponsor = {
  id: string
  league_id: string
  name: string
  logo_url: string | null
  website_url: string | null
  display_order: number
  created_at: string
}

export type LeagueGalleryPhoto = {
  id: string
  league_id: string
  photo_url: string
  caption: string | null
  created_at: string
}

export type LeagueTeam = {
  id: string
  league_id: string
  name: string
  color: string
  logo_url: string | null
  join_token: string
  available_days: number[] | null
  fee_paid: boolean
  fee_note: string | null
  division_id: string | null
  created_at: string
}

export type LeaguePlayer = {
  id: string
  team_id: string
  league_id: string
  profile_id: string | null
  display_name: string
  jersey_number: string | null
  position: string | null
  is_claimed: boolean
  created_at: string
}

export type LeagueGame = {
  id: string
  league_id: string
  home_team_id: string
  away_team_id: string
  scheduled_at: string
  location: string | null
  status: 'scheduled' | 'final' | 'cancelled'
  home_score: number | null
  away_score: number | null
  game_type: 'regular' | 'playoff' | null
  playoff_round: number | null
  playoff_bracket_slot: number | null
  court_id: string | null
  division_id: string | null
  created_at: string
}

export type LeagueGameAttendance = {
  id: string
  game_id: string
  player_id: string
  status: 'yes' | 'no' | 'maybe'
  updated_at: string
}

export type LeaguePlayerStat = {
  id: string
  game_id: string
  player_id: string
  team_id: string
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fouls: number
  three_pointers_made: number
  three_pointers_attempted: number
  field_goals_made: number
  field_goals_attempted: number
  free_throws_made: number
  free_throws_attempted: number
}
