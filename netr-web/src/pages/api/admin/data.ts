import type { NextApiRequest, NextApiResponse } from 'next'

const ADMIN_PASSWORD = 'dimesandnickles4'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://obroygzzfpphumsrqtsm.supabase.co'
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
// Use service role key when available (bypasses RLS), fall back to anon key
const AUTH_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ANON_KEY

async function sbCount(table: string, filter = ''): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=id`
  if (filter) url += `&${filter}`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: AUTH_KEY,
        Authorization: `Bearer ${AUTH_KEY}`,
        'Prefer': 'count=exact',
        'Range': '0-0',
      },
    })
    const range = res.headers.get('Content-Range') || ''
    const total = range.split('/')[1]
    return total && total !== '*' ? parseInt(total, 10) : 0
  } catch { return 0 }
}

async function sbFetch(table: string, select: string, filter = '', order = '', limit = 100): Promise<any[]> {
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`
  if (filter) url += `&${filter}`
  if (order) url += `&order=${order}`
  try {
    const res = await fetch(url, {
      headers: {
        apikey: AUTH_KEY,
        Authorization: `Bearer ${AUTH_KEY}`,
        'Prefer': 'count=none',
        'Range': `0-${limit - 1}`,
      },
    })
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch { return [] }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' })

  const [
    usersCount, courtsCount, verifiedCount, pendingCount,
    ratingsCount, postsCount, leaguesCount, activeLeaguesCount,
    teamsCount, playersCount, gamesCount,
    crewsCount, crewMembersCount, publicCrewsCount,
    users, courts, pendingCourts, ratings, posts, leagues, crews,
  ] = await Promise.all([
    sbCount('profiles'),
    sbCount('courts'),
    sbCount('courts', 'verified=eq.true'),
    sbCount('courts', 'verified=eq.false'),
    sbCount('ratings'),
    sbCount('feed_posts'),
    sbCount('leagues'),
    sbCount('leagues', 'is_active=eq.true'),
    sbCount('league_teams'),
    sbCount('league_players'),
    sbCount('league_games'),
    sbCount('crews'),
    sbCount('crew_members'),
    sbCount('crews', 'is_public=eq.true'),
    sbFetch('profiles', 'id,username,full_name,netr_score,created_at', '', 'created_at.desc', 1000),
    sbFetch('courts', 'id,name,city,verified,surface,created_at', '', 'created_at.desc', 5000),
    sbFetch('courts', 'id,name,city,submitted_by,created_at', 'verified=eq.false', 'created_at.desc', 500),
    sbFetch('ratings', 'id,rater_id,rated_id,overall_score,created_at', '', 'created_at.desc', 100),
    sbFetch('feed_posts', 'id,author_id,content,created_at', '', 'created_at.desc', 50),
    sbFetch('leagues', 'id,name,slug,sport,season,is_active,created_at,owner_id,location,league_teams(count),league_players(count),league_games(count)', '', 'created_at.desc', 500),
    // crews_safe view permanently excludes the password column
    sbFetch('crews_safe', 'id,name,icon,icon_url,is_public,creator_id,created_at,crew_members(count)', '', 'created_at.desc', 1000),
  ])

  return res.status(200).json({
    counts: {
      users: usersCount, courts: courtsCount, verified: verifiedCount, pending: pendingCount,
      ratings: ratingsCount, posts: postsCount, leagues: leaguesCount, activeLeagues: activeLeaguesCount,
      teams: teamsCount, players: playersCount, games: gamesCount,
      crews: crewsCount, crewMembers: crewMembersCount, publicCrews: publicCrewsCount,
    },
    users, courts, pendingCourts, ratings, posts, leagues, crews,
  })
}
