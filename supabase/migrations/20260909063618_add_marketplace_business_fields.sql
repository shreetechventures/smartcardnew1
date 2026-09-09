-- Add business listing fields to marketplace_listings
ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS business_location text,
  ADD COLUMN IF NOT EXISTS business_category text,
  ADD COLUMN IF NOT EXISTS contact_no text,
  ADD COLUMN IF NOT EXISTS business_info text;