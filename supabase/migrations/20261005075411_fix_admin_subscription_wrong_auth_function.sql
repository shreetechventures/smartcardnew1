/*
# Fix admin_update_company_subscription — wrong auth function called

## Root Cause
The function body calls `public.is_admin(p_admin_email, p_admin_password_hash)` but
only a no-arg `is_admin()` exists. The 2-argument version does not exist, so the
function fails at runtime.

Every other admin RPC (admin_get_companies, admin_suspend_company, etc.) uses
`public.verify_admin_credentials(p_email, p_password_hash)` for credential checking.
This function should do the same.

## Fix
1. Recreate admin_update_company_subscription with the correct auth check:
   `public.verify_admin_credentials(p_admin_email, p_admin_password_hash)`
2. Grant EXECUTE to anon + authenticated (matching other admin RPCs).
3. Keep SECURITY DEFINER, search_path=public.
4. Subscription logic: start = now(), expiry = now() + 1 year (yearly plans only).
*/

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
  IF NOT public.verify_admin_credentials(p_admin_email, p_admin_password_hash) THEN
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
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO authenticated;
