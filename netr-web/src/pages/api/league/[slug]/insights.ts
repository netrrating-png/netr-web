import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { generateLeagueInsights, fetchCachedInsights, InsightResult } from '../../../../lib/league-insights'

// Allow up to 60s on Vercel Pro; hobby tier caps at 10s (insights take ~5-8s typically)
export const config = { maxDuration: 60 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query as { slug: string }
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  // Resolve slug → leagueId
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: league } = await supabase.from('leagues').select('id').eq('slug', slug).single()
  if (!league) return res.status(404).json({ error: 'League not found' })

  const leagueId = league.id

  // ── GET: serve cache if fresh, regenerate if stale or missing ───────────────
  if (req.method === 'GET') {
    const STALE_MS = 6 * 60 * 60 * 1000 // 6 hours — catches code deploys and NETR updates

    const { data: latest } = await supabase
      .from('league_ai_insights')
      .select('generated_at')
      .eq('league_id', leagueId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    const isStale = !latest?.generated_at ||
      Date.now() - new Date(latest.generated_at).getTime() > STALE_MS

    if (!isStale) {
      const cached = await fetchCachedInsights(leagueId)
      if (cached && cached.length > 0)
        return res.status(200).json({ insights: cached, generated: true })
    }

    // Stale or missing — regenerate synchronously
    try {
      const fresh = await generateLeagueInsights(leagueId)
      return res.status(200).json({ insights: fresh, generated: true, generated_at: new Date().toISOString() })
    } catch {
      // Generation failed — fall back to whatever cache exists rather than returning empty
      const cached = await fetchCachedInsights(leagueId)
      if (cached && cached.length > 0)
        return res.status(200).json({ insights: cached, generated: true })
      return res.status(200).json({ insights: [], generated: false })
    }
  }

  // ── POST: regenerate insights ─────────────────────────────────────────────
  if (req.method === 'POST') {
    // Auth: require ADMIN_PASSWORD header OR league owner session
    const adminKey = req.headers['x-admin-key']
    const isAdmin  = adminKey && adminKey === process.env.ADMIN_PASSWORD

    if (!isAdmin) {
      // Fall back to checking if the requesting user owns this league
      const authHeader = req.headers.authorization
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' })

      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })

      const { data: ownedLeague } = await supabase.from('leagues').select('id').eq('id', leagueId).eq('owner_id', user.id).single()
      if (!ownedLeague) return res.status(403).json({ error: 'Forbidden' })
    }

    try {
      const insights: InsightResult[] = await generateLeagueInsights(leagueId)
      return res.status(200).json({ insights, generated: true, generated_at: new Date().toISOString() })
    } catch (err) {
      console.error('Insights generation failed:', err)
      return res.status(500).json({ error: 'Failed to generate insights', detail: String(err) })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
