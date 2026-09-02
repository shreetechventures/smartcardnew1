-- ============================================================
-- Fix: Admin panel uses anon Supabase client (not Supabase Auth)
-- All admin functions and tables need anon access.
-- Admin functions now verify credentials internally instead of
-- relying on auth.uid() which is NULL for the anon client.
-- ============================================================

-- ============================================================
-- 1. Rewrite is_admin() to accept credential parameters
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_admin_credentials(p_email text, p_password_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE lower(admin_email) = lower(p_email)
      AND admin_password_hash = p_password_hash
  );
$$;

REVOKE EXECUTE ON FUNCTION public.verify_admin_credentials(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_credentials(text, text) TO anon;

-- ============================================================
-- 2. Rewrite admin_get_companies to verify credentials internally
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_companies(p_admin_email text DEFAULT NULL, p_admin_password_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'plan_id', c.plan_id,
      'subscription_status', c.subscription_status,
      'subscription_expires_at', c.subscription_expires_at,
      'created_at', c.created_at,
      'member_count', (
        SELECT count(*) FROM public.company_members WHERE company_id = c.id
      )
    )
  ) FROM public.companies c;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_companies(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_companies(text, text) TO anon;

-- ============================================================
-- 3. Rewrite admin_get_users
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_users(p_admin_email text DEFAULT NULL, p_admin_password_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_agg(
    jsonb_build_object(
      'user_id', u.id,
      'email', u.email,
      'full_name', p.full_name,
      'company_id', cm.company_id,
      'company_name', co.name,
      'role', cm.role,
      'status', cm.status,
      'created_at', u.created_at
    )
  )
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.company_members cm ON cm.user_id = u.id
  LEFT JOIN public.companies co ON co.id = cm.company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_users(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users(text, text) TO anon;

-- ============================================================
-- 4. Rewrite admin_get_invoices
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_invoices(p_admin_email text DEFAULT NULL, p_admin_password_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'company_id', i.company_id,
      'company_name', c.name,
      'plan_id', i.plan_id,
      'amount', i.amount,
      'currency', i.currency,
      'status', i.status,
      'created_at', i.created_at,
      'paid_at', i.paid_at
    )
  )
  FROM public.invoices i
  LEFT JOIN public.companies c ON c.id = i.company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_invoices(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_invoices(text, text) TO anon;

-- ============================================================
-- 5. Rewrite admin_get_payment_attempts
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_payment_attempts(p_admin_email text DEFAULT NULL, p_admin_password_hash text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN jsonb_agg(
    jsonb_build_object(
      'id', pa.id,
      'invoice_id', pa.invoice_id,
      'company_id', pa.company_id,
      'company_name', c.name,
      'gateway_order_id', pa.gateway_order_id,
      'gateway_payment_id', pa.gateway_payment_id,
      'amount', pa.amount,
      'status', pa.status,
      'failure_reason', pa.failure_reason,
      'created_at', pa.created_at,
      'paid_at', pa.paid_at
    )
  )
  FROM public.payment_attempts pa
  LEFT JOIN public.companies c ON c.id = pa.company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_payment_attempts(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_attempts(text, text) TO anon;

-- ============================================================
-- 6. Rewrite admin_update_company_subscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_subscription_status text,
  p_admin_email text DEFAULT NULL,
  p_admin_password_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET plan_id = p_plan_id,
      subscription_status = p_subscription_status,
      updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO anon;

-- ============================================================
-- 7. Rewrite admin_suspend_company
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_suspend_company(
  p_company_id uuid,
  p_suspend boolean DEFAULT true,
  p_admin_email text DEFAULT NULL,
  p_admin_password_hash text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET subscription_status = CASE WHEN p_suspend THEN 'cancelled' ELSE 'active' END,
      updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean, text, text) TO anon;

-- ============================================================
-- 8. Grant anon access to admin_settings table (non-sensitive cols)
-- ============================================================
REVOKE ALL ON public.admin_settings FROM anon;
GRANT SELECT (id, admin_email, allow_registrations, auto_approve_cards, maintenance_mode, platform_version, created_at, updated_at) ON public.admin_settings TO anon;
GRANT UPDATE (allow_registrations, auto_approve_cards, maintenance_mode, admin_email, admin_password_hash, updated_at) ON public.admin_settings TO anon;

-- Add anon RLS policies for admin_settings
DROP POLICY IF EXISTS "anon_select_admin_settings" ON public.admin_settings;
CREATE POLICY "anon_select_admin_settings" ON public.admin_settings FOR SELECT
  TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_admin_settings" ON public.admin_settings;
CREATE POLICY "anon_update_admin_settings" ON public.admin_settings FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 9. Grant anon access to plans_config table
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON public.plans_config TO anon;

-- Add anon RLS policies for plans_config
DROP POLICY IF EXISTS "anon_insert_plans_config" ON public.plans_config;
CREATE POLICY "anon_insert_plans_config" ON public.plans_config FOR INSERT
  TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_plans_config" ON public.plans_config;
CREATE POLICY "anon_update_plans_config" ON public.plans_config FOR UPDATE
  TO anon USING (true) WITH CHECK (true);

-- read_plans_config already includes anon
