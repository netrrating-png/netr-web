import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const host = (request.headers.get('host') || '').split(':')[0]
  const bare = host.replace(/^www\./, '')

  // Skip NETR's own domains
  if (bare === 'netr.pro' || bare.endsWith('.netr.pro') || bare.includes('localhost') || bare.includes('vercel.app')) {
    return NextResponse.next()
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/leagues?custom_domain=eq.${bare}&custom_domain_status=eq.active&select=slug&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Content-Type': 'application/json',
        },
        // 1-second timeout — don't slow down every request if Supabase is slow
        signal: AbortSignal.timeout(1000),
      }
    )

    if (res.ok) {
      const rows: { slug: string }[] = await res.json()
      if (rows[0]?.slug) {
        const url = request.nextUrl.clone()
        url.pathname = `/league/${rows[0].slug}`
        return NextResponse.rewrite(url)
      }
    }
  } catch {
    // DNS lookup or fetch failed — fall through and serve normally
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|css|js)).*)',
  ],
}
