/*
# Create analytics_events table for real dashboard metrics

## Purpose
Creates a dedicated analytics events table to power real, data-backed dashboard metrics:
  - Total Card Views (public card/profile visits)
  - Total Reviews (review completion = Google action click)
  - Average Rating (customer star rating selections)
  - Activity Over Time (real events per day)

## New Tables
- `analytics_events`
  - `id` (uuid, primary key)
  - `company_id` (uuid, references companies)
  - `event_type` (text: 'card_view' | 'rating' | 'review_completion')
  - `rating` (integer, nullable — only set for 'rating' events, 1-5)
  - `session_id` (text, nullable — used for deduplication per browser session)
  - `card_id` (uuid, nullable — references cards for card_view events)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on analytics_events.
- SELECT: authenticated users can read events for their own company (via company_members).
- INSERT: anon + authenticated can insert (public customers submit events without login).
- No UPDATE or DELETE policies (events are immutable).

## Indexes
- `idx_analytics_events_company_id` on `company_id`.
- `idx_analytics_events_company_type_created` on `(company_id, event_type, created_at)`.
- `idx_analytics_events_session` on `(session_id, event_type, company_id)`.

## Important Notes
1. This table does NOT modify any existing tables or logic.
2. Session-based deduplication prevents duplicate counts from React re-renders, StrictMode, and page reloads.
*/

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('card_view', 'rating', 'review_completion')),
  rating integer CHECK (rating >= 1 AND rating <= 5),
  session_id text,
  card_id uuid REFERENCES cards(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_analytics" ON analytics_events;
CREATE POLICY "select_own_analytics"
ON analytics_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = analytics_events.company_id
    AND company_members.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_analytics_public" ON analytics_events;
CREATE POLICY "insert_analytics_public"
ON analytics_events FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_analytics_events_company_id ON analytics_events(company_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_company_type_created ON analytics_events(company_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id, event_type, company_id);
