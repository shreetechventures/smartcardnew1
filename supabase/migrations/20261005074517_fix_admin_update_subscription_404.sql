/*
# Fix admin_update_company_subscription 404 — drop orphaned 3-param overload

## Root Cause
The function `admin_update_company_subscription` exists in TWO overloads:
1. (p_company_id uuid, p_plan_id text, p_subscription_status text) — old 3-param version
2. (p_company_id uuid, p_plan_id text, p_subscription_status text, p_admin_email text, p_admin_password_hash text) — current 5-param version

PostgREST cannot resolve which overload to invoke when the frontend sends 5 named params,
so it returns HTTP 404 for /rest/v1/rpc/admin_update_company_subscription.

## Fix
1. Drop the old 3-param overload explicitly.
2. Recreate the 5-param version (with yearly subscription logic) to ensure it exists.
3. Grant execute to authenticated only.

## Subscription Logic
- When status = 'active': subscription_start_at = now(), subscription_expires_at = now() + 1 year
- All plans are yearly. No monthly/3-month durations.

## Security
- SECURITY DEFINER, guarded by is_admin() check.
- Execute granted to authenticated only, revoked from anon.
*/

DROP FUNCTION IF EXISTS public.admin_update_company_subscription(uuid, text, text);

CREATE OR REPLACE FUNCTION public.admin_update_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_subscription_status text,
  p_admin_email text DEFAULT NULL,
  p_admin_password_hash text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE companies
  SET
    plan_id = p_plan_id,
    subscription_status = p_subscription_status,
    subscription_start_at = CASE WHEN p_subscription_status = 'active' THEN now() ELSE subscription_start_at END,
    subscription_expires_at = CASE
      WHEN p_subscription_status = 'active' THEN now() + interval '1 year'
      ELSE subscription_expires_at
    END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO authenticated;
