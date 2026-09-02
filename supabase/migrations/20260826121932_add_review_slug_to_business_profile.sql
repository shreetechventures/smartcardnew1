/*
# Add review_slug to business_profile

1. Purpose
   Each business needs a unique, human-readable URL for its public review page
   (e.g. /review/sharma-electronics). This adds a `review_slug` column to
   `business_profile` with a unique constraint so no two businesses can share
   the same review URL.

2. Changes
   - Add column `review_slug` (text, nullable) to `business_profile`.
   - Add a UNIQUE constraint on `review_slug`.
   - Backfill existing rows by slugifying their `business_name`.

3. Security
   - No RLS policy changes — existing policies remain in effect.
*/

ALTER TABLE business_profile
  ADD COLUMN IF NOT EXISTS review_slug text;

-- Add unique index (IF NOT EXISTS supported on indexes)
CREATE UNIQUE INDEX IF NOT EXISTS business_profile_review_slug_key
  ON business_profile (review_slug)
  WHERE review_slug IS NOT NULL;

-- Backfill existing rows from business_name
DO $$
BEGIN
  UPDATE business_profile
  SET review_slug = lower(
    regexp_replace(
      regexp_replace(
        trim(business_name),
        '[^a-zA-Z0-9]+', '-', 'g'
      ),
      '^-+|-+$', '', 'g'
    )
  )
  WHERE review_slug IS NULL AND business_name IS NOT NULL;
END $$;