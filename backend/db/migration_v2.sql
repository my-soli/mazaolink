-- MazaoLink v2 — farmer features migration
-- Run in Supabase SQL Editor

-- Weather opt-in on farmers
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS weather_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS village TEXT;

-- Market reference prices (admin-managed)
CREATE TABLE IF NOT EXISTS market_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT UNIQUE NOT NULL,        -- chai, maziwa, viazi, etc.
  price_per_unit NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE market_prices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_market_prices_type ON market_prices(type);

-- Seed with Nakuru County average prices
INSERT INTO market_prices (type, price_per_unit, unit) VALUES
  ('chai',    380,  'kg'),
  ('maziwa',   55,  'litre'),
  ('viazi',    30,  'kg'),
  ('mahindi',  35,  'kg'),
  ('mboga',    40,  'kg'),
  ('nyanya',   60,  'kg'),
  ('karoti',   50,  'kg'),
  ('kabichi',  25,  'kg'),
  ('ndizi',    20,  'kg'),
  ('ndengu',   90,  'kg')
ON CONFLICT (type) DO NOTHING;

-- Add expired status to produce and cattle
ALTER TABLE produce ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');
ALTER TABLE cattle  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

-- Index for expiry cron job
CREATE INDEX IF NOT EXISTS idx_produce_expires ON produce(expires_at) WHERE status = 'available';
CREATE INDEX IF NOT EXISTS idx_cattle_expires  ON cattle(expires_at)  WHERE status = 'available';
