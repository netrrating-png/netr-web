import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(url, anonKey)

export type League = {
  id: string
  owner_id: string
  name: string
  slug: string
  sport: string
  season: string | null
  location: string | null
  description: string | null
  is_active: boolean
  created_at: string
}

export type LeagueTeam = {
  id: string
  league_id: string
  name: string
  color: string
  join_token: string
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
  created_at: string
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
}
