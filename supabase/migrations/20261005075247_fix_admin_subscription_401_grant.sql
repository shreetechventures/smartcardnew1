/*
# Fix admin_update_company_subscription 401 Unauthorized

## Root Cause
The admin panel uses a custom session token (stored in sessionStorage), NOT Supabase Auth.
All RPC calls from the admin browser therefore arrive as the `anon` role.

Every other admin RPC (admin_get_companies, admin_suspend_company, admin_update_user_role, etc.)
grants EXECUTE to `anon` for this reason. The security comes from the `is_admin()` check
inside each function body, not from the EXECUTE privilege.

The previous fix migration (fix_admin_update_subscription_404) revoked EXECUTE from anon/PUBLIC
and only granted to `authenticated`. This caused PostgREST to return 401 Unauthorized because
the admin browser's requests run as `anon`, not `authenticated`.

## Fix
Grant EXECUTE on admin_update_company_subscription to `anon` and `PUBLIC`, matching the
pattern used by every other admin function. The function remains secure because:
1. It is SECURITY DEFINER
2. It calls is_admin(p_admin_email, p_admin_password_hash) at the top
3. It raises 'Unauthorized' if the admin credentials don't match

## Subscription Logic (unchanged)
- When status = 'active': subscription_start_at = now(), subscription_expires_at = now() + 1 year
- All plans are yearly.
*/

REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text, text, text) TO authenticated;
