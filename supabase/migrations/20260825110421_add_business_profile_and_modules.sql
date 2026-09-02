/*
# Business Profile + AI Studio + Website Builder + Marketplace

## Overview
Adds a central business_profile table that stores one-time business information
which feeds all platform modules (cards, posters, websites, marketplace listings).
Also adds tables for AI-generated posters, websites built with the builder, and
marketplace listings.

## New Tables
1. business_profile — single-row central business data (name, tagline, logo,
   colors, contact info, social links, address, about). All modules read from this.
2. posters — AI-generated poster designs created from the business profile.
3. websites — websites built using the website builder, linked to business profile.
4. marketplace_listings — templates and services listed on the marketplace.

## Security
- RLS enabled on all new tables.
- All policies use TO anon, authenticated (single-tenant app, no auth).
*/

-- Business Profile (central data source for all modules)
CREATE TABLE IF NOT EXISTS business_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text NOT NULL,
  tagline text,
  logo_url text,
  primary_color text DEFAULT '#5648db',
  secondary_color text DEFAULT '#7c3aed',
  owner_name text,
  owner_title text,
  email text,
  phone text,
  whatsapp text,
  website text,
  address text,
  city text,
  state text,
  pincode text,
  about text,
  facebook text,
  instagram text,
  twitter text,
  linkedin text,
  youtube text,
  google_business text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_business_profile" ON business_profile;
CREATE POLICY "anon_select_business_profile" ON business_profile FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_business_profile" ON business_profile;
CREATE POLICY "anon_insert_business_profile" ON business_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_business_profile" ON business_profile;
CREATE POLICY "anon_update_business_profile" ON business_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_business_profile" ON business_profile;
CREATE POLICY "anon_delete_business_profile" ON business_profile FOR DELETE
  TO anon, authenticated USING (true);

-- Posters (AI Studio)
CREATE TABLE IF NOT EXISTS posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  template text NOT NULL DEFAULT 'modern',
  headline text,
  subheadline text,
  offer_text text,
  cta_text text DEFAULT 'Visit Now',
  background_color text DEFAULT '#5648db',
  text_color text DEFAULT '#ffffff',
  image_prompt text,
  image_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_posters" ON posters;
CREATE POLICY "anon_select_posters" ON posters FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_posters" ON posters;
CREATE POLICY "anon_insert_posters" ON posters FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_posters" ON posters;
CREATE POLICY "anon_update_posters" ON posters FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_posters" ON posters;
CREATE POLICY "anon_delete_posters" ON posters FOR DELETE
  TO anon, authenticated USING (true);

-- Websites (Website Builder)
CREATE TABLE IF NOT EXISTS websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  domain text,
  template text NOT NULL DEFAULT 'business',
  is_published boolean NOT NULL DEFAULT false,
  sections text[] NOT NULL DEFAULT '{"hero","about","services","contact"}',
  hero_title text,
  hero_subtitle text,
  hero_image text,
  services text,
  gallery text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE websites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_websites" ON websites;
CREATE POLICY "anon_select_websites" ON websites FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_websites" ON websites;
CREATE POLICY "anon_insert_websites" ON websites FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_websites" ON websites;
CREATE POLICY "anon_update_websites" ON websites FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_websites" ON websites;
CREATE POLICY "anon_delete_websites" ON websites FOR DELETE
  TO anon, authenticated USING (true);

-- Marketplace Listings
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'template' CHECK (category IN ('template','service','addon','theme')),
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  creator text,
  rating numeric(2,1) NOT NULL DEFAULT 5.0,
  downloads integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE marketplace_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_marketplace" ON marketplace_listings;
CREATE POLICY "anon_select_marketplace" ON marketplace_listings FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_marketplace" ON marketplace_listings;
CREATE POLICY "anon_insert_marketplace" ON marketplace_listings FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_marketplace" ON marketplace_listings;
CREATE POLICY "anon_update_marketplace" ON marketplace_listings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_marketplace" ON marketplace_listings;
CREATE POLICY "anon_delete_marketplace" ON marketplace_listings FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_posters_status ON posters(status);
CREATE INDEX IF NOT EXISTS idx_websites_published ON websites(is_published);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_listings(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_listings(status);
