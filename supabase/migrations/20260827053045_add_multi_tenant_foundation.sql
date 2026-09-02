/*
# Multi-tenant foundation: companies, memberships, company-scoped data isolation

Creates companies, company_members, profiles, invoices, payment_attempts tables.
Adds company_id to all business tables. Rewrites all RLS policies to enforce
company membership. Auto-creates profile on signup.
*/

-- ============================================================
-- 1. NEW TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan_id text NOT NULL DEFAULT 'starter',
  subscription_status text NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial','active','expired','cancelled')),
  subscription_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','editor','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded','expired')),
  due_date timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  gateway_order_id text,
  gateway_payment_id text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled','refunded','expired')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- ============================================================
-- 2. ADD company_id TO ALL BUSINESS TABLES
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cards' AND column_name='company_id') THEN
    ALTER TABLE public.cards ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='company_id') THEN
    ALTER TABLE public.contacts ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='leads' AND column_name='company_id') THEN
    ALTER TABLE public.leads ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reviews' AND column_name='company_id') THEN
    ALTER TABLE public.reviews ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qr_codes' AND column_name='company_id') THEN
    ALTER TABLE public.qr_codes ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='company_id') THEN
    ALTER TABLE public.payments ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='marketplace_listings' AND column_name='company_id') THEN
    ALTER TABLE public.marketplace_listings ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='business_profile' AND column_name='company_id') THEN
    ALTER TABLE public.business_profile ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='websites' AND column_name='company_id') THEN
    ALTER TABLE public.websites ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='posters' AND column_name='company_id') THEN
    ALTER TABLE public.posters ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='company_id') THEN
    ALTER TABLE public.products ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_requests' AND column_name='company_id') THEN
    ALTER TABLE public.review_requests ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='review_templates' AND column_name='company_id') THEN
    ALTER TABLE public.review_templates ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='company_id') THEN
    ALTER TABLE public.notifications ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='team_members' AND column_name='company_id') THEN
    ALTER TABLE public.team_members ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_settings' AND column_name='company_id') THEN
    ALTER TABLE public.user_settings ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.company_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
    AND user_id = auth.uid()
  );
$$;

-- ============================================================
-- 4. ENABLE RLS + POLICIES ON NEW TABLES
-- ============================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_company" ON public.companies;
CREATE POLICY "select_own_company" ON public.companies FOR SELECT
  TO authenticated USING (public.is_company_member(id));
DROP POLICY IF EXISTS "insert_own_company" ON public.companies;
CREATE POLICY "insert_own_company" ON public.companies FOR INSERT
  TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_own_company" ON public.companies;
CREATE POLICY "update_own_company" ON public.companies FOR UPDATE
  TO authenticated USING (public.is_company_member(id)) WITH CHECK (public.is_company_member(id));

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_membership" ON public.company_members;
CREATE POLICY "select_own_membership" ON public.company_members FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.is_company_member(company_id));
DROP POLICY IF EXISTS "insert_membership_as_owner" ON public.company_members;
CREATE POLICY "insert_membership_as_owner" ON public.company_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );
DROP POLICY IF EXISTS "update_membership_if_owner_admin" ON public.company_members;
CREATE POLICY "update_membership_if_owner_admin" ON public.company_members FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );
DROP POLICY IF EXISTS "delete_membership_if_owner_admin" ON public.company_members;
CREATE POLICY "delete_membership_if_owner_admin" ON public.company_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles FOR SELECT
  TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE
  TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_company_invoices" ON public.invoices;
CREATE POLICY "select_company_invoices" ON public.invoices FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS "insert_company_invoices" ON public.invoices;
CREATE POLICY "insert_company_invoices" ON public.invoices FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_company_invoices" ON public.invoices;
CREATE POLICY "update_company_invoices" ON public.invoices FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_company_invoices" ON public.invoices;
CREATE POLICY "delete_company_invoices" ON public.invoices FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_company_payment_attempts" ON public.payment_attempts;
CREATE POLICY "select_company_payment_attempts" ON public.payment_attempts FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS "insert_company_payment_attempts" ON public.payment_attempts;
CREATE POLICY "insert_company_payment_attempts" ON public.payment_attempts FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_company_payment_attempts" ON public.payment_attempts;
CREATE POLICY "update_company_payment_attempts" ON public.payment_attempts FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_company_payment_attempts" ON public.payment_attempts;
CREATE POLICY "delete_company_payment_attempts" ON public.payment_attempts FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 5. REWRITE RLS ON EXISTING BUSINESS TABLES
-- ============================================================

-- CARDS
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_cards" ON public.cards;
DROP POLICY IF EXISTS "anon_insert_cards" ON public.cards;
DROP POLICY IF EXISTS "anon_update_cards" ON public.cards;
DROP POLICY IF EXISTS "anon_delete_cards" ON public.cards;
CREATE POLICY "select_company_cards" ON public.cards FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_cards" ON public.cards FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_cards" ON public.cards FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_cards" ON public.cards FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- CONTACTS
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_insert_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_update_contacts" ON public.contacts;
DROP POLICY IF EXISTS "anon_delete_contacts" ON public.contacts;
CREATE POLICY "select_company_contacts" ON public.contacts FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_contacts" ON public.contacts FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_contacts" ON public.contacts FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_contacts" ON public.contacts FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- LEADS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_leads" ON public.leads;
DROP POLICY IF EXISTS "anon_insert_leads" ON public.leads;
DROP POLICY IF EXISTS "anon_update_leads" ON public.leads;
DROP POLICY IF EXISTS "anon_delete_leads" ON public.leads;
CREATE POLICY "select_company_leads" ON public.leads FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_leads" ON public.leads FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_leads" ON public.leads FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_leads" ON public.leads FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- REVIEWS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_insert_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_update_reviews" ON public.reviews;
DROP POLICY IF EXISTS "anon_delete_reviews" ON public.reviews;
CREATE POLICY "select_company_reviews" ON public.reviews FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_reviews" ON public.reviews FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_reviews" ON public.reviews FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_reviews" ON public.reviews FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- QR_CODES
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "anon_insert_qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "anon_update_qr_codes" ON public.qr_codes;
DROP POLICY IF EXISTS "anon_delete_qr_codes" ON public.qr_codes;
CREATE POLICY "select_company_qr_codes" ON public.qr_codes FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_qr_codes" ON public.qr_codes FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_qr_codes" ON public.qr_codes FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_qr_codes" ON public.qr_codes FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- PAYMENTS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_insert_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_update_payments" ON public.payments;
DROP POLICY IF EXISTS "anon_delete_payments" ON public.payments;
CREATE POLICY "select_company_payments" ON public.payments FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_payments" ON public.payments FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_payments" ON public.payments FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_payments" ON public.payments FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- MARKETPLACE_LISTINGS
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_insert_marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_update_marketplace_listings" ON public.marketplace_listings;
DROP POLICY IF EXISTS "anon_delete_marketplace_listings" ON public.marketplace_listings;
CREATE POLICY "select_published_marketplace" ON public.marketplace_listings FOR SELECT
  TO anon, authenticated USING (status = 'active' OR public.is_company_member(company_id));
CREATE POLICY "insert_company_marketplace" ON public.marketplace_listings FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_marketplace" ON public.marketplace_listings FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_marketplace" ON public.marketplace_listings FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- BUSINESS_PROFILE
ALTER TABLE public.business_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_business_profile" ON public.business_profile;
DROP POLICY IF EXISTS "anon_insert_business_profile" ON public.business_profile;
DROP POLICY IF EXISTS "anon_update_business_profile" ON public.business_profile;
DROP POLICY IF EXISTS "anon_delete_business_profile" ON public.business_profile;
CREATE POLICY "select_company_business_profile" ON public.business_profile FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_business_profile" ON public.business_profile FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_business_profile" ON public.business_profile FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_business_profile" ON public.business_profile FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- WEBSITES
ALTER TABLE public.websites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_websites" ON public.websites;
DROP POLICY IF EXISTS "anon_insert_websites" ON public.websites;
DROP POLICY IF EXISTS "anon_update_websites" ON public.websites;
DROP POLICY IF EXISTS "anon_delete_websites" ON public.websites;
CREATE POLICY "select_company_websites" ON public.websites FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_websites" ON public.websites FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_websites" ON public.websites FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_websites" ON public.websites FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- POSTERS
ALTER TABLE public.posters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_posters" ON public.posters;
DROP POLICY IF EXISTS "anon_insert_posters" ON public.posters;
DROP POLICY IF EXISTS "anon_update_posters" ON public.posters;
DROP POLICY IF EXISTS "anon_delete_posters" ON public.posters;
CREATE POLICY "select_company_posters" ON public.posters FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_posters" ON public.posters FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_posters" ON public.posters FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_posters" ON public.posters FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_products" ON public.products;
DROP POLICY IF EXISTS "anon_insert_products" ON public.products;
DROP POLICY IF EXISTS "anon_update_products" ON public.products;
DROP POLICY IF EXISTS "anon_delete_products" ON public.products;
CREATE POLICY "select_company_products" ON public.products FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_products" ON public.products FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_products" ON public.products FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_products" ON public.products FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- REVIEW_REQUESTS
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_review_requests" ON public.review_requests;
DROP POLICY IF EXISTS "anon_insert_review_requests" ON public.review_requests;
DROP POLICY IF EXISTS "anon_update_review_requests" ON public.review_requests;
DROP POLICY IF EXISTS "anon_delete_review_requests" ON public.review_requests;
CREATE POLICY "select_company_review_requests" ON public.review_requests FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_review_requests" ON public.review_requests FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_review_requests" ON public.review_requests FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_review_requests" ON public.review_requests FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- REVIEW_TEMPLATES
ALTER TABLE public.review_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_review_templates" ON public.review_templates;
DROP POLICY IF EXISTS "anon_insert_review_templates" ON public.review_templates;
DROP POLICY IF EXISTS "anon_update_review_templates" ON public.review_templates;
DROP POLICY IF EXISTS "anon_delete_review_templates" ON public.review_templates;
CREATE POLICY "select_company_review_templates" ON public.review_templates FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_review_templates" ON public.review_templates FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_review_templates" ON public.review_templates FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_review_templates" ON public.review_templates FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_update_notifications" ON public.notifications;
DROP POLICY IF EXISTS "anon_delete_notifications" ON public.notifications;
CREATE POLICY "select_company_notifications" ON public.notifications FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_notifications" ON public.notifications FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_notifications" ON public.notifications FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_notifications" ON public.notifications FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- TEAM_MEMBERS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_team_members" ON public.team_members;
DROP POLICY IF EXISTS "anon_insert_team_members" ON public.team_members;
DROP POLICY IF EXISTS "anon_update_team_members" ON public.team_members;
DROP POLICY IF EXISTS "anon_delete_team_members" ON public.team_members;
CREATE POLICY "select_company_team_members" ON public.team_members FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_team_members" ON public.team_members FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_team_members" ON public.team_members FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_team_members" ON public.team_members FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- USER_SETTINGS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "anon_insert_user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "anon_update_user_settings" ON public.user_settings;
DROP POLICY IF EXISTS "anon_delete_user_settings" ON public.user_settings;
CREATE POLICY "select_company_user_settings" ON public.user_settings FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
CREATE POLICY "insert_company_user_settings" ON public.user_settings FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "update_company_user_settings" ON public.user_settings FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
CREATE POLICY "delete_company_user_settings" ON public.user_settings FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 6. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cards_company_id ON public.cards(company_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company_id ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_company_id ON public.reviews(company_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_company_id ON public.qr_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON public.payments(company_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_company_id ON public.marketplace_listings(company_id);
CREATE INDEX IF NOT EXISTS idx_business_profile_company_id ON public.business_profile(company_id);
CREATE INDEX IF NOT EXISTS idx_websites_company_id ON public.websites(company_id);
CREATE INDEX IF NOT EXISTS idx_posters_company_id ON public.posters(company_id);
CREATE INDEX IF NOT EXISTS idx_products_company_id ON public.products(company_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_company_id ON public.review_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_review_templates_company_id ON public.review_templates(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_company_id ON public.team_members(company_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_company_id ON public.user_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_company_id ON public.payment_attempts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user_id ON public.company_members(user_id);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON public.company_members(company_id);

-- ============================================================
-- 7. TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
