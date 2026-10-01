/*
# Update verify_admin_credentials to accept session tokens

## Purpose
All admin RPC functions (admin_get_companies, admin_get_users, admin_get_invoices,
admin_update_company_subscription, admin_suspend_company, admin_update_user_role,
admin_update_user_status, admin_delete_user) call verify_admin_credentials(p_email, p_password_hash)
to authorize the request.

Previously, p_password_hash was the actual SHA-256 hash of the admin password.
Now the admin page sends a session token instead. This migration updates
verify_admin_credentials to accept EITHER:
  1. A valid session token (checked via is_valid_admin_session + email match), OR
  2. The original password hash (backward compatibility for edge functions that
     still pass the hash directly)

This is a single-point change — all calling functions automatically gain
session token support without individual modifications.

## Security
- Session tokens are checked for validity (not expired, not revoked)
- The email from the session must match the p_email parameter
- Backward compatibility with the hash is maintained for edge functions
  that verify via verify_admin_login() before calling RPC functions
*/

CREATE OR REPLACE FUNCTION public.verify_admin_credentials(p_email text, p_password_hash text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  -- Check 1: is p_password_hash actually a session token?
  SELECT EXISTS (
    SELECT 1 FROM public.admin_sessions s
    WHERE s.token = p_password_hash
      AND s.revoked = false
      AND s.expires_at > now()
      AND lower(s.admin_email) = lower(p_email)
  )
  OR
  -- Check 2: legacy hash-based verification (for edge functions passing the real hash)
  EXISTS (
    SELECT 1 FROM public.admin_settings
    WHERE lower(admin_email) = lower(p_email)
      AND admin_password_hash = p_password_hash
  );
$$;
