/*
# Card Enhancements + Complete Review System + Product Menu

## Overview
1. Adds logo_url, video_url, upi_id to cards table for company logo,
   video intro, and UPI payment on the digital card.
2. Expands reviews table with source, status, tags, business_reply,
   reply_at fields for the full reputation management system.
3. Creates products table for the product/service menu on digital cards.
4. Creates review_requests table for tracking outbound review invitations.
5. Creates review_templates table for reusable review request messages.

## Security
- RLS enabled on all new tables with anon+authenticated access.
*/

-- Add logo, video, UPI to cards
ALTER TABLE cards ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS video_url text;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS upi_id text;

-- Expand reviews for reputation management
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'direct' CHECK (source IN ('google','facebook','justdial','whatsapp','direct','other'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'public' CHECK (status IN ('public','need_attention','hidden','resolved'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS business_reply text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reply_at timestamptz;

-- Products table (product/service menu on cards)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  category text,
  is_available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- Review requests table (outbound review invitations)
CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','email','qr','link')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','opened','completed','failed')),
  rating integer,
  review_id uuid REFERENCES reviews(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_review_requests" ON review_requests;
CREATE POLICY "anon_select_review_requests" ON review_requests FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_review_requests" ON review_requests;
CREATE POLICY "anon_insert_review_requests" ON review_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_review_requests" ON review_requests;
CREATE POLICY "anon_update_review_requests" ON review_requests FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_review_requests" ON review_requests;
CREATE POLICY "anon_delete_review_requests" ON review_requests FOR DELETE
  TO anon, authenticated USING (true);

-- Review templates table (reusable request messages)
CREATE TABLE IF NOT EXISTS review_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms','email')),
  subject text,
  body text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE review_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_review_templates" ON review_templates;
CREATE POLICY "anon_select_review_templates" ON review_templates FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_review_templates" ON review_templates;
CREATE POLICY "anon_insert_review_templates" ON review_templates FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_review_templates" ON review_templates;
CREATE POLICY "anon_update_review_templates" ON review_templates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_review_templates" ON review_templates;
CREATE POLICY "anon_delete_review_templates" ON review_templates FOR DELETE
  TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_card_id ON products(card_id);
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_review_requests_status ON review_requests(status);
