/*
# Add review routing rules table

## Purpose
Persists the review routing configuration so that the dashboard's
"Review Routing" tab settings survive page reloads instead of being
lost on refresh. Previously these rules lived only in React state.

## New Table
- `review_routing_rules`
  - `id` (uuid, primary key)
  - `positive` (text) — destination for 4-5 star ratings: 'google' | 'facebook' | 'justdial' | 'feedback'
  - `neutral` (text) — destination for 3 star ratings: 'google' | 'feedback'
  - `negative` (text) — destination for 1-2 star ratings: 'feedback' | 'google'
  - `updated_at` (timestamptz, defaults to now())

## Security
- RLS enabled.
- Single-tenant app (no sign-in screen) so policies use `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` because this configuration data
  is intentionally shared/public across the dashboard.
*/

CREATE TABLE IF NOT EXISTS review_routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  positive text NOT NULL DEFAULT 'google',
  neutral text NOT NULL DEFAULT 'feedback',
  negative text NOT NULL DEFAULT 'feedback',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE review_routing_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_routing_rules" ON review_routing_rules;
CREATE POLICY "anon_select_routing_rules" ON review_routing_rules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_routing_rules" ON review_routing_rules;
CREATE POLICY "anon_insert_routing_rules" ON review_routing_rules FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_routing_rules" ON review_routing_rules;
CREATE POLICY "anon_update_routing_rules" ON review_routing_rules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_routing_rules" ON review_routing_rules;
CREATE POLICY "anon_delete_routing_rules" ON review_routing_rules FOR DELETE
  TO anon, authenticated USING (true);

-- Seed a default row if none exists
INSERT INTO review_routing_rules (positive, neutral, negative)
SELECT 'google', 'feedback', 'feedback'
WHERE NOT EXISTS (SELECT 1 FROM review_routing_rules);
