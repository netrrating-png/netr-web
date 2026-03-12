# NETR Web

Landing page, player rate pages, QR campaigns, and team admin dashboard.

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/rate?user=marcus_t&name=Marcus+T.&score=6.8` | Player share page (QR / link from app) |
| `/qr?c=rucker` | QR campaign landing (auto-redirects on mobile) |
| `/admin` | Team admin dashboard (password protected) |

## QR Campaigns

Each court or channel gets its own campaign key:
- `default` — generic beta invite
- `rucker` — Rucker Park court flyer
- `dyckman` — Dyckman Park court flyer
- `west4` — West 4th Street court flyer
- `flyer` — print / poster use
- `instagram` — Instagram bio link

Add new campaigns in `src/pages/qr.tsx` → `CAMPAIGNS` object.

Preview all QR codes in the **Admin → QR Campaigns** tab.

## Setup

```bash
cp .env.local.example .env.local
# Fill in your values

npm install
npm run dev
```

## Deploy to Vercel

1. Push to GitHub
2. Import repo on vercel.com
3. Add env vars in Vercel dashboard (same as .env.local)
4. Deploy

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `NEXT_PUBLIC_ADMIN_PASS` | Team admin password |
| `NEXT_PUBLIC_TESTFLIGHT_URL` | TestFlight invite link |

## Admin Access

Go to `/admin` — enter the team password set in `NEXT_PUBLIC_ADMIN_PASS`.

The admin shows:
- Live user/court/rating counts from Supabase
- Pending court approvals (approve with one click)
- All QR codes with preview + PNG download
- Feed moderation
