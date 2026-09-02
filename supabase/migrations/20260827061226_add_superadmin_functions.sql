/*
# Phase 4: SuperAdmin functions

Creates SECURITY DEFINER functions that allow the platform admin to read
across all companies. Access is controlled by checking the admin_settings
table for the admin email — only the designated admin can call these.

## Functions
1. admin_get_companies — all companies with member counts
2. admin_get_users — all profiles + company memberships
3. admin_get_invoices — all invoices across companies
4. admin_get_payment_attempts — all payment attempts
5. admin_update_company_subscription — change a company's plan/status
6. admin_suspend_company — suspend a company
*/

-- ============================================================
-- HELPER: check if caller is admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE admin_email = (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ============================================================
-- 1. ADMIN GET COMPANIES
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_companies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_get_companies() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_companies() TO authenticated;

-- ============================================================
-- 2. ADMIN GET USERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_users()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;

-- ============================================================
-- 3. ADMIN GET INVOICES
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_invoices()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_get_invoices() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_invoices() TO authenticated;

-- ============================================================
-- 4. ADMIN GET PAYMENT ATTEMPTS
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_get_payment_attempts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE EXECUTE ON FUNCTION public.admin_get_payment_attempts() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_attempts() TO authenticated;

-- ============================================================
-- 5. ADMIN UPDATE COMPANY SUBSCRIPTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_subscription_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET plan_id = p_plan_id,
      subscription_status = p_subscription_status,
      updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) TO authenticated;

-- ============================================================
-- 6. ADMIN SUSPEND COMPANY
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_suspend_company(
  p_company_id uuid,
  p_suspend boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET subscription_status = CASE WHEN p_suspend THEN 'cancelled' ELSE 'active' END,
      updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean) TO authenticated;
