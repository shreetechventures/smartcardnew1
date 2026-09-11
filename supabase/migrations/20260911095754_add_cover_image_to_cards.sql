/*
# Add cover image to cards

1. Changes
   - Added `cover_url` column (text, nullable) to the `cards` table.
   - This stores a banner/cover image URL that displays at the top of a
     shared SmartCard, behind the profile photo and logo.

2. Security
   - No new tables. No policy changes needed — existing card RLS policies
     already cover all columns on the table, so the new column inherits
     the same read/write rules.
*/

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS cover_url text;