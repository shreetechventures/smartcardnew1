/*
# Feature Access Control System

1. New Tables
- `plan_feature_access` — controls which features are enabled per plan (starter, business, growth, pro).
  - `plan_id` (text, primary key)
  - `features` (jsonb) — object mapping feature keys to booleans
  - `updated_at` (timestamptz)

- `user_feature_overrides` — per-user overrides that take precedence over plan-level settings.
  - `user_id` (uuid, primary key) — references auth.users
  - `company_id` (uuid) — references companies
  - `features` (jsonb) — same shape as plan_feature_access.features
  - `updated_at` (timestamptz)

2. Default Data
- Inserts default rows for all 4 plans with all 15 features enabled.

3. Security
- RLS enabled on both tables.
- plan_feature_access: readable by all authenticated users, writable only via admin RPC.
- user_feature_overrides: readable by authenticated users who are members of the company, writable only via admin RPC.

4. Notes
- Feature keys match the NavKey type in dashboard-shell.tsx exactly.
- The dashboard checks: user override first, then plan-level, then defaults to enabled.
*/

CREATE TABLE IF NOT EXISTS plan_feature_access (
  plan_id text PRIMARY KEY,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plan_feature_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_plan_features" ON plan_feature_access;
CREATE POLICY "authenticated_read_plan_features"
  ON plan_feature_access FOR SELECT
  TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_feature_overrides (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_own_overrides" ON user_feature_overrides;
CREATE POLICY "authenticated_read_own_overrides"
  ON user_feature_overrides FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- Seed default plan feature access (all features enabled)
INSERT INTO plan_feature_access (plan_id, features)
VALUES
  ('starter', '{
    "Dashboard": true, "Business Setup": true, "My Cards": true, "Leads": true,
    "Analytics": true, "Reviews": true, "QR Codes": true, "Contacts": true,
    "AI Studio": true, "Website Builder": true, "Marketplace": true, "Team": true,
    "Subscription": true, "Payments": true, "Settings": true
  }'::jsonb),
  ('business', '{
    "Dashboard": true, "Business Setup": true, "My Cards": true, "Leads": true,
    "Analytics": true, "Reviews": true, "QR Codes": true, "Contacts": true,
    "AI Studio": true, "Website Builder": true, "Marketplace": true, "Team": true,
    "Subscription": true, "Payments": true, "Settings": true
  }'::jsonb),
  ('growth', '{
    "Dashboard": true, "Business Setup": true, "My Cards": true, "Leads": true,
    "Analytics": true, "Reviews": true, "QR Codes": true, "Contacts": true,
    "AI Studio": true, "Website Builder": true, "Marketplace": true, "Team": true,
    "Subscription": true, "Payments": true, "Settings": true
  }'::jsonb),
  ('pro', '{
    "Dashboard": true, "Business Setup": true, "My Cards": true, "Leads": true,
    "Analytics": true, "Reviews": true, "QR Codes": true, "Contacts": true,
    "AI Studio": true, "Website Builder": true, "Marketplace": true, "Team": true,
    "Subscription": true, "Payments": true, "Settings": true
  }'::jsonb)
ON CONFLICT (plan_id) DO NOTHING;
