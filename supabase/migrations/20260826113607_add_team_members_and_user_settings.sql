/*
# Add team_members and user_settings tables

1. New Tables
- `team_members` — stores team members with name, email, role (Owner/Admin/Editor/Viewer), status (active/invited/suspended). Seeded with 4 members.
- `user_settings` — single-row table storing user profile + notification preferences + UI preferences (dark mode, language, timezone).

2. Security
- Enable RLS on both tables.
- No-auth app: policies use `TO anon, authenticated` with `USING (true)` since data is intentionally shared.
*/

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'Editor' CHECK (role = ANY (ARRAY['Owner', 'Admin', 'Editor', 'Viewer'])),
  status text NOT NULL DEFAULT 'invited' CHECK (status = ANY (ARRAY['active', 'invited', 'suspended'])),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_team_members" ON team_members;
CREATE POLICY "anon_select_team_members" ON team_members FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_team_members" ON team_members;
CREATE POLICY "anon_insert_team_members" ON team_members FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_team_members" ON team_members;
CREATE POLICY "anon_update_team_members" ON team_members FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_team_members" ON team_members;
CREATE POLICY "anon_delete_team_members" ON team_members FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Sumit Jambure',
  email text NOT NULL DEFAULT 'sumit@shreetech.co',
  phone text NOT NULL DEFAULT '+91 98765 43210',
  company text NOT NULL DEFAULT 'Shree Tech Ventures',
  bio text NOT NULL DEFAULT 'Building digital identity solutions for modern professionals.',
  email_alerts boolean NOT NULL DEFAULT true,
  lead_alerts boolean NOT NULL DEFAULT true,
  review_alerts boolean NOT NULL DEFAULT false,
  weekly_report boolean NOT NULL DEFAULT true,
  dark_mode boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'English',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata (IST)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_user_settings" ON user_settings;
CREATE POLICY "anon_select_user_settings" ON user_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_user_settings" ON user_settings;
CREATE POLICY "anon_insert_user_settings" ON user_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_user_settings" ON user_settings;
CREATE POLICY "anon_update_user_settings" ON user_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Seed team members
INSERT INTO team_members (name, email, role, status) VALUES
  ('Sumit Jambure', 'sumit@shreetech.co', 'Owner', 'active'),
  ('Sneha Patel', 'sneha@shreetech.co', 'Admin', 'active'),
  ('Rohit Gupta', 'rohit@shreetech.co', 'Editor', 'active'),
  ('Ananya Iyer', 'ananya@shreetech.co', 'Editor', 'invited')
ON CONFLICT DO NOTHING;

-- Seed user settings
INSERT INTO user_settings (name, email) VALUES ('Sumit Jambure', 'sumit@shreetech.co')
ON CONFLICT DO NOTHING;