-- Stripe Connect account on leagues
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS payment_modes_enabled TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS installment_count INTEGER NOT NULL DEFAULT 3;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS installment_interval TEXT NOT NULL DEFAULT 'month';

-- Payment tracking on league_teams
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS payment_mode TEXT CHECK (payment_mode IN ('full', 'split', 'plan'));
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS installments_paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE league_teams ADD COLUMN IF NOT EXISTS installments_total INTEGER;

-- Per-player payments table (split mode)
CREATE TABLE IF NOT EXISTS league_player_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES league_teams(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_email TEXT,
  stripe_session_id TEXT UNIQUE,
  amount_cents INTEGER NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: league owners can read/write their own data; anon can insert (to create payment records before paying)
ALTER TABLE league_player_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_manage_player_payments" ON league_player_payments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM leagues l WHERE l.id = league_id AND l.owner_id = auth.uid()
    )
  );

-- Allow anon reads for the public pay page (needs to know existing payers for split)
CREATE POLICY "public_read_player_payments" ON league_player_payments
  FOR SELECT USING (true);
