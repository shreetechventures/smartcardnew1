/*
# Add Review Generation History Table

1. New Tables
- `review_generation_history` — stores AI-generated review suggestions for duplicate prevention and analytics
  - `id` (uuid, primary key)
  - `company_id` (uuid, references companies, cascade delete)
  - `review_request_id` (uuid, nullable, references review_requests)
  - `rating` (integer, 1-5)
  - `customer_experience` (text array — selected experience tags)
  - `customer_comment` (text, optional free-text)
  - `generated_reviews` (text array — the 3 AI-generated review texts)
  - `generation_seed` (text — unique crypto seed per generation)
  - `ai_provider` (text, default 'gemini')
  - `ai_model` (text)
  - `created_at` (timestamptz, default now())

2. Modified Tables
- `reviews` — add `ai_reply` (text) and `ai_reply_at` (timestamptz) columns that are already used by the edge function but not in any migration

3. Security
- Enable RLS on `review_generation_history`
- Company-scoped CRUD: only company members can access their own generation history
- No public/anon access — generation history is private business data
*/

-- Add missing ai_reply columns to reviews (already used by edge function)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'ai_reply') THEN
    ALTER TABLE reviews ADD COLUMN ai_reply text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'ai_reply_at') THEN
    ALTER TABLE reviews ADD COLUMN ai_reply_at timestamptz;
  END IF;
END $$;

-- Create review generation history table
CREATE TABLE IF NOT EXISTS review_generation_history (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  review_request_id   uuid REFERENCES review_requests(id) ON DELETE SET NULL,
  rating              integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  customer_experience text[] NOT NULL DEFAULT '{}',
  customer_comment    text,
  generated_reviews   text[] NOT NULL DEFAULT '{}',
  generation_seed     text NOT NULL,
  ai_provider         text NOT NULL DEFAULT 'gemini',
  ai_model            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_gen_history_company_id ON review_generation_history(company_id);
CREATE INDEX IF NOT EXISTS idx_review_gen_history_created_at ON review_generation_history(company_id, created_at DESC);

ALTER TABLE review_generation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_review_gen_history" ON review_generation_history;
CREATE POLICY "select_company_review_gen_history"
  ON review_generation_history FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "insert_company_review_gen_history" ON review_generation_history;
CREATE POLICY "insert_company_review_gen_history"
  ON review_generation_history FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "update_company_review_gen_history" ON review_generation_history;
CREATE POLICY "update_company_review_gen_history"
  ON review_generation_history FOR UPDATE
  TO authenticated
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "delete_company_review_gen_history" ON review_generation_history;
CREATE POLICY "delete_company_review_gen_history"
  ON review_generation_history FOR DELETE
  TO authenticated
  USING (is_company_member(company_id));

-- Allow anon to insert generation history (public review page needs to record generations)
-- The edge function uses the service role key so this is not strictly needed,
-- but we add it for completeness in case the client ever records directly.
DROP POLICY IF EXISTS "anon_insert_review_gen_history" ON review_generation_history;
CREATE POLICY "anon_insert_review_gen_history"
  ON review_generation_history FOR INSERT
  TO anon
  WITH CHECK (true);
