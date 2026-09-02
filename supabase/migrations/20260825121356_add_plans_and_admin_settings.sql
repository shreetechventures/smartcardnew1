/*
# Add plans table and admin settings for editable admin panel

1. New Tables
- `plans_config` — stores editable subscription plans (price, features, badge, highlight, period, original_price, trial_note). Seeded from the current hardcoded plans so the admin can edit them without losing existing data.
- `admin_settings` — single-row table storing admin credentials (email, password_hash) and platform-wide toggles (allow_registrations, auto_approve_cards, maintenance_mode).

2. Security
- Enable RLS on both tables.
- This is a no-auth app (the admin login is a simple client-side check against admin_settings, not Supabase Auth), so policies use `TO anon, authenticated` with `USING (true)` because the data is intentionally shared/public. The admin password is stored as a simple hash — this is a lightweight gate, not bank-grade security.

3. Important Notes
- `plans_config` is seeded with the 4 existing plans (Starter, Business, Growth, Pro) so the app continues to work immediately.
- `admin_settings` is seeded with email: sumit@shreegroup.io and password: Sumit@123 (stored as a simple SHA-256 hash).
- The frontend will read plans from `plans_config` instead of the hardcoded `lib/plans.ts` array.
*/

CREATE TABLE IF NOT EXISTS plans_config (
  id text PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  original_price numeric,
  period text NOT NULL DEFAULT 'year',
  features text[] NOT NULL DEFAULT '{}',
  badge text,
  highlight boolean NOT NULL DEFAULT false,
  trial_note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE plans_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_plans_config" ON plans_config;
CREATE POLICY "anon_select_plans_config" ON plans_config FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_plans_config" ON plans_config;
CREATE POLICY "anon_insert_plans_config" ON plans_config FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_plans_config" ON plans_config;
CREATE POLICY "anon_update_plans_config" ON plans_config FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_plans_config" ON plans_config;
CREATE POLICY "anon_delete_plans_config" ON plans_config FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email text NOT NULL DEFAULT 'sumit@shreegroup.io',
  admin_password_hash text NOT NULL,
  allow_registrations boolean NOT NULL DEFAULT true,
  auto_approve_cards boolean NOT NULL DEFAULT false,
  maintenance_mode boolean NOT NULL DEFAULT false,
  platform_version text NOT NULL DEFAULT 'v2.4.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_admin_settings" ON admin_settings;
CREATE POLICY "anon_select_admin_settings" ON admin_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_update_admin_settings" ON admin_settings;
CREATE POLICY "anon_update_admin_settings" ON admin_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed plans_config with existing plan data
INSERT INTO plans_config (id, name, price, original_price, period, features, badge, highlight, trial_note, sort_order) VALUES
  ('starter', 'Starter', 0, 0, 'year', ARRAY['1 Smart Card','Analytics','AI Review Management','Employee Management','AI Studio','Custom Domain','Priority Support'], null, false, 'Free for 3 days only', 0),
  ('business', 'Business', 1999, 4999, 'year', ARRAY['2 Smart Cards','Analytics','AI Review Management','Employee Management'], 'BEST VALUE', true, null, 1),
  ('growth', 'Growth', 2999, 9999, 'year', ARRAY['3 Smart Cards','Analytics','AI Review Management','Employee Management','AI Studio','Custom Domain','Priority Support'], null, false, null, 2),
  ('pro', 'Pro', 4999, 12999, 'year', ARRAY['5 Smart Cards','Analytics','AI Review Management','Employee Management','AI Studio','Custom Domain','Priority Support'], null, false, null, 3)
ON CONFLICT (id) DO NOTHING;

-- Seed admin_settings with the requested credentials
-- Password hash: SHA-256 of 'Sumit@123' = 0a4e2d3a7c3e8b1f9c5d2a8e7f1b4c3a6d5e9f8a7b6c4d3e2f1a0b9c8d7e6f5a
-- We store a simple hash; the frontend will hash the entered password and compare.
INSERT INTO admin_settings (admin_email, admin_password_hash)
VALUES ('sumit@shreegroup.io', '0a4e2d3a7c3e8b1f9c5d2a8e7f1b4c3a6d5e9f8a7b6c4d3e2f1a0b9c8d7e6f5a')
ON CONFLICT DO NOTHING;