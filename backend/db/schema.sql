-- MazaoLink — Supabase Schema
-- Run this in your Supabase project: SQL Editor > New Query > paste > Run

-- Farmers
CREATE TABLE farmers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  phone TEXT UNIQUE NOT NULL,
  village TEXT,
  language TEXT DEFAULT 'sw',        -- sw = Swahili, en = English
  registered_via TEXT DEFAULT 'sms', -- sms | ussd | whatsapp | agent | app
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produce listings (tea, milk, vegetables, etc.)
CREATE TABLE produce (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL,             -- kg | litres | bags | crates
  price_per_unit NUMERIC NOT NULL,
  status TEXT DEFAULT 'available', -- available | matched | sold
  ref TEXT UNIQUE NOT NULL,        -- e.g. SL-2847
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cattle listings
CREATE TABLE cattle (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  farmer_id UUID REFERENCES farmers(id) ON DELETE CASCADE,
  breed TEXT NOT NULL,
  age_years INTEGER,
  weight_kg NUMERIC,
  price NUMERIC NOT NULL,
  status TEXT DEFAULT 'available',
  ref TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders (placed by buyers)
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  produce_id UUID REFERENCES produce(id),
  cattle_id UUID REFERENCES cattle(id),
  buyer_name TEXT,
  buyer_phone TEXT,
  quantity NUMERIC,
  total_price NUMERIC,
  status TEXT DEFAULT 'pending',   -- pending | confirmed | completed | cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- M-Pesa transactions
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id),
  mpesa_ref TEXT,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL,              -- c2b (buyer pays in) | b2c (farmer payout)
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'pending',   -- pending | completed | failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast phone lookups (used on every SMS/USSD hit)
CREATE INDEX idx_farmers_phone ON farmers(phone);
CREATE INDEX idx_produce_farmer ON produce(farmer_id);
CREATE INDEX idx_produce_status ON produce(status);
CREATE INDEX idx_cattle_farmer ON cattle(farmer_id);
CREATE INDEX idx_orders_status ON orders(status);
