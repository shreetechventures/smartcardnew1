/*
# Complete Smart Review System Overhaul

## Summary
This migration transforms the review system from a basic rating collector into a full
review-routing + customer-feedback + Google-review-conversion platform.

## Changes

### 1. New Table: `review_campaigns`
Allows businesses to create themed review campaigns (e.g. "Post-Dinner Feedback",
"Guest Checkout Feedback", "Patient Experience") with custom questions and branding.
- `id` (uuid PK)
- `company_id` (uuid FK → companies, ON DELETE CASCADE)
- `name` (text, not null) — campaign name
- `description` (text) — what this campaign is about
- `question` (text) — custom question shown on review page
- `is_active` (boolean, default true)
- `slug` (text, unique) — for campaign-specific URLs
- `google_review_url` (text) — override business-level Google URL per campaign
- `created_at`, `updated_at` (timestamps)

### 2. Enhanced `reviews` table
Added columns to support the full review routing system:
- `customer_phone` (text) — customer contact for follow-up
- `customer_email` (text) — customer email for follow-up
- `campaign_id` (uuid FK → review_campaigns, nullable) — which campaign generated this review
- `routed_to` (text) — where the customer was routed: 'google', 'facebook', 'justdial', 'feedback'
- `google_redirect_clicked` (boolean, default false) — did the customer actually click through to Google?
- `follow_up_status` (text, default 'none') — internal follow-up tracking: 'none', 'pending', 'contacted', 'resolved'
- `follow_up_notes` (text) — internal notes for staff
- `follow_up_at` (timestamptz) — when follow-up occurred

### 3. Updated `reviews` constraints
- Added 'campaign' to the source CHECK constraint
- Added new follow_up_status values to a new CHECK constraint

### 4. Enhanced `business_profile` table
- `review_heading` (text) — custom heading for review page (e.g. "How was your experience with us?")
- `review_subheading` (text) — subtext under the heading
- `review_background_color` (text) — custom background color for review page
- `review_thank_you_message` (text) — custom thank you message

### 5. Security (RLS)
- `review_campaigns`: full CRUD for authenticated company members only
- `reviews`: existing policies unchanged; anon INSERT policy already added in prior migration
- `business_profile`: existing policies unchanged; anon SELECT already added
- `review_routing_rules`: anon SELECT already added in prior migration
*/

-- ============================================================
-- 1. Create review_campaigns table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  question text,
  is_active boolean NOT NULL DEFAULT true,
  slug text UNIQUE,
  google_review_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.review_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_campaigns" ON public.review_campaigns;
CREATE POLICY "select_company_campaigns"
  ON public.review_campaigns FOR SELECT
  TO authenticated
  USING (is_company_member(company_id));

DROP POLICY IF EXISTS "insert_company_campaigns" ON public.review_campaigns;
CREATE POLICY "insert_company_campaigns"
  ON public.review_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "update_company_campaigns" ON public.review_campaigns;
CREATE POLICY "update_company_campaigns"
  ON public.review_campaigns FOR UPDATE
  TO authenticated
  USING (is_company_member(company_id))
  WITH CHECK (is_company_member(company_id));

DROP POLICY IF EXISTS "delete_company_campaigns" ON public.review_campaigns;
CREATE POLICY "delete_company_campaigns"
  ON public.review_campaigns FOR DELETE
  TO authenticated
  USING (is_company_member(company_id));

-- Allow anon to read active campaigns (for public review page)
DROP POLICY IF EXISTS "anon_select_active_campaigns" ON public.review_campaigns;
CREATE POLICY "anon_select_active_campaigns"
  ON public.review_campaigns FOR SELECT
  TO anon
  USING (is_active = true);

-- ============================================================
-- 2. Add columns to reviews table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'customer_phone') THEN
    ALTER TABLE public.reviews ADD COLUMN customer_phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'customer_email') THEN
    ALTER TABLE public.reviews ADD COLUMN customer_email text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'campaign_id') THEN
    ALTER TABLE public.reviews ADD COLUMN campaign_id uuid REFERENCES public.review_campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'routed_to') THEN
    ALTER TABLE public.reviews ADD COLUMN routed_to text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'google_redirect_clicked') THEN
    ALTER TABLE public.reviews ADD COLUMN google_redirect_clicked boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'follow_up_status') THEN
    ALTER TABLE public.reviews ADD COLUMN follow_up_status text NOT NULL DEFAULT 'none';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'follow_up_notes') THEN
    ALTER TABLE public.reviews ADD COLUMN follow_up_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reviews' AND column_name = 'follow_up_at') THEN
    ALTER TABLE public.reviews ADD COLUMN follow_up_at timestamptz;
  END IF;
END $$;

-- Update source constraint to include 'campaign'
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_source_check') THEN
    ALTER TABLE public.reviews DROP CONSTRAINT reviews_source_check;
  END IF;
END $$;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_source_check
  CHECK (source = ANY (ARRAY['google'::text, 'facebook'::text, 'justdial'::text, 'whatsapp'::text, 'direct'::text, 'campaign'::text, 'other'::text]));

-- Add follow_up_status constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_follow_up_status_check') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_follow_up_status_check
      CHECK (follow_up_status = ANY (ARRAY['none'::text, 'pending'::text, 'contacted'::text, 'resolved'::text]));
  END IF;
END $$;

-- ============================================================
-- 3. Add review page customization columns to business_profile
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profile' AND column_name = 'review_heading') THEN
    ALTER TABLE public.business_profile ADD COLUMN review_heading text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profile' AND column_name = 'review_subheading') THEN
    ALTER TABLE public.business_profile ADD COLUMN review_subheading text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profile' AND column_name = 'review_background_color') THEN
    ALTER TABLE public.business_profile ADD COLUMN review_background_color text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_profile' AND column_name = 'review_thank_you_message') THEN
    ALTER TABLE public.business_profile ADD COLUMN review_thank_you_message text;
  END IF;
END $$;

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON public.reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_campaign_id ON public.reviews(campaign_id);
CREATE INDEX IF NOT EXISTS idx_reviews_follow_up_status ON public.reviews(follow_up_status);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_company_id ON public.review_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_review_campaigns_slug ON public.review_campaigns(slug);
