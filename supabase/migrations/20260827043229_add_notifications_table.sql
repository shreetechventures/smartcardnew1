/*
# Add notifications table

## Purpose
Stores real notifications for the dashboard navbar bell icon — new leads,
new reviews, new contacts, payment confirmations, etc. Previously the bell
icon was purely decorative with no dropdown.

## New Table
- `notifications`
  - `id` (uuid, primary key)
  - `type` (text) — 'lead' | 'review' | 'contact' | 'payment' | 'system'
  - `title` (text) — short title
  - `message` (text) — body text
  - `is_read` (boolean, default false)
  - `link` (text, nullable) — navigation target e.g. 'Leads'
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled, single-tenant no-auth app → `TO anon, authenticated` with
  `USING (true)` / `WITH CHECK (true)` since notifications are shared.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_notifications" ON notifications;
CREATE POLICY "anon_select_notifications" ON notifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_notifications" ON notifications;
CREATE POLICY "anon_insert_notifications" ON notifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_notifications" ON notifications;
CREATE POLICY "anon_update_notifications" ON notifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_notifications" ON notifications;
CREATE POLICY "anon_delete_notifications" ON notifications FOR DELETE
  TO anon, authenticated USING (true);

-- Seed a few sample notifications
INSERT INTO notifications (type, title, message, link)
SELECT 'lead', 'New Lead Captured', 'A new lead came in from QR scan', 'Leads'
WHERE NOT EXISTS (SELECT 1 FROM notifications);

INSERT INTO notifications (type, title, message, link)
SELECT 'review', 'New 5-Star Review', 'Someone left a positive review on Google', 'Reviews'
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'review');

INSERT INTO notifications (type, title, message, link)
SELECT 'system', 'Welcome to TheSmartCard', 'Complete your business setup to get started', 'Business Setup'
WHERE NOT EXISTS (SELECT 1 FROM notifications WHERE type = 'system');
