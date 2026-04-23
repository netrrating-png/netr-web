import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { promises as dns } from 'dns'

const CNAME_TARGET = 'leagues.netr.pro'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { leagueId } = req.body as { leagueId: string }
  if (!leagueId) return res.status(400).json({ error: 'leagueId required' })

  const { data: league } = await supabase
    .from('leagues')
    .select('custom_domain')
    .eq('id', leagueId)
    .single()

  if (!league?.custom_domain) return res.status(400).json({ error: 'No custom domain set' })

  const domain = league.custom_domain.replace(/^www\./, '')

  let resolved = false
  for (const host of [domain, `www.${domain}`]) {
    try {
      const cnames = await dns.resolveCname(host)
      if (cnames.some(c => c.replace(/\.$/, '') === CNAME_TARGET)) {
        resolved = true
        break
      }
    } catch {
      // DNS lookup failed for this host — try next
    }
  }

  const status = resolved ? 'active' : 'error'
  await supabase
    .from('leagues')
    .update({ custom_domain_status: status })
    .eq('id', leagueId)

  res.status(200).json({ status })
}
