/*
# Phase 5: Remove dangerous open policies

Drops the old anon/USING(true) policies that were left over from
earlier migrations and replaces them with proper access controls.

## Tables fixed:
1. marketplace_listings — remove old anon policies (new company-scoped ones already exist)
2. plans_config — restrict to authenticated only (admin manages via admin functions)
3. review_routing_rules — restrict to authenticated + company-scoped
*/

-- ============================================================
-- 1. MARKETPLACE LISTINGS — remove old anon policies
-- ============================================================

DROP POLICY IF EXISTS "anon_select_marketplace" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_insert_marketplace" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_update_marketplace" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_delete_marketplace" ON public.marketplace_listings;

-- Revoke anon access entirely
REVOKE ALL ON public.marketplace_listings FROM anon;

-- Keep the company-scoped policies that were already created
-- (select_published_marketplace, insert_company_marketplace, etc.)
-- But make sure anon can still read published listings for the public marketplace
CREATE POLICY "anon_select_published_marketplace" ON public.marketplace_listings
  FOR SELECT TO anon USING (status = 'active');

-- ============================================================
-- 2. PLANS_CONFIG — restrict to authenticated only
-- ============================================================

DROP POLICY IF EXISTS "anon_select_plans_config" ON public.plans_config;
DROP POLICY IF EXISTS "anon_insert_plans_config" ON public.plans_config;
DROP POLICY IF EXISTS "anon_update_plans_config" ON public.plans_config;
DROP POLICY IF EXISTS "anon_delete_plans_config" ON public.plans_config;

REVOKE ALL ON public.plans_config FROM anon;

-- Anyone (including the landing page) can read plans
CREATE POLICY "read_plans_config" ON public.plans_config
  FOR SELECT TO anon, authenticated USING (true);

-- Only authenticated can modify (admin does this through the admin panel)
CREATE POLICY "insert_plans_config" ON public.plans_config
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_plans_config" ON public.plans_config
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_plans_config" ON public.plans_config
  FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 3. REVIEW_ROUTING_RULES — restrict to authenticated + company-scoped
-- ============================================================

-- Check if review_routing_rules has company_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_routing_rules' AND column_name='company_id') THEN
    ALTER TABLE public.review_routing_rules ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "anon_select_routing_rules" ON public.review_routing_rules;
DROP POLICY IF EXISTS "anon_insert_routing_rules" ON public.review_routing_rules;
DROP POLICY IF EXISTS "anon_update_routing_rules" ON public.review_routing_rules;
DROP POLICY IF EXISTS "anon_delete_routing_rules" ON public.review_routing_rules;

REVOKE ALL ON public.review_routing_rules FROM anon;

CREATE POLICY "select_company_routing_rules" ON public.review_routing_rules
  FOR SELECT TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_routing_rules" ON public.review_routing_rules
  FOR INSERT TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_routing_rules" ON public.review_routing_rules
  FOR UPDATE TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_routing_rules" ON public.review_routing_rules
  FOR DELETE TO authenticated USING (public.is_company_member(company_id));

CREATE INDEX IF NOT EXISTS idx_review_routing_rules_company_id ON public.review_routing_rules(company_id);
