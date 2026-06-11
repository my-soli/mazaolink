-- MazaoLink: buyers table migration
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS buyers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  interests TEXT[] DEFAULT '{}',       -- e.g. {'produce','tea','milk','cattle'}
  active BOOLEAN DEFAULT TRUE,
  registered_via TEXT DEFAULT 'portal', -- portal | sms | admin
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (reads blocked by default; backend uses service_role key)
ALTER TABLE buyers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_buyers_phone ON buyers(phone);
CREATE INDEX IF NOT EXISTS idx_buyers_active ON buyers(active);
