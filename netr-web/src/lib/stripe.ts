import Stripe from 'stripe'

// Lazy proxy — initialization happens on first method call (inside a try/catch),
// not at import time. This prevents module-load crashes when env vars are missing.
let _stripe: Stripe | undefined

export const stripe = new Proxy({} as Stripe, {
  get(_, prop: string) {
    if (!_stripe) {
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) throw new Error('STRIPE_SECRET_KEY env var is not set')
      _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia', typescript: true })
    }
    return (_stripe as unknown as Record<string, unknown>)[prop]
  },
})
