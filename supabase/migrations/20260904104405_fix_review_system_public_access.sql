-- Fix: Public review page needs anon access to read business profiles by review_slug,
-- read routing rules by company_id, and insert reviews from public visitors.

-- 1. Allow anon to SELECT business_profile (needed for public review page lookup by slug)
CREATE POLICY "anon_select_business_profile_by_slug"
  ON public.business_profile FOR SELECT
  TO anon
  USING (true);

-- 2. Allow anon to SELECT review_routing_rules (needed for public review page to route by rating)
CREATE POLICY "anon_select_review_routing_rules"
  ON public.review_routing_rules FOR SELECT
  TO anon
  USING (true);

-- 3. Allow anon to INSERT into reviews (public visitors submitting feedback from review link)
CREATE POLICY "anon_insert_reviews"
  ON public.reviews FOR INSERT
  TO anon
  WITH CHECK (true);
