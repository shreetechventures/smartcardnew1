/*
# Phase 5: Security fixes

1. Revoke anon EXECUTE on all admin SECURITY DEFINER functions
2. Lock down admin_settings table — only authenticated can read, and
   the password_hash column should never be exposed via the API
3. Revoke column-level SELECT on admin_password_hash from anon and authenticated
*/

-- ============================================================
-- 1. REVOKE ANON EXECUTE ON ADMIN FUNCTIONS
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_companies() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_invoices() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_payment_attempts() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean) FROM anon;

-- ============================================================
-- 2. LOCK DOWN admin_settings TABLE
-- ============================================================

-- Drop the wide-open policies
DROP POLICY IF EXISTS "anon_select_admin_settings" ON public.admin_settings;
DROP POLICY IF EXISTS "anon_update_admin_settings" ON public.admin_settings;

-- Only authenticated users can read (they need to check admin email for login)
CREATE POLICY "authenticated_select_admin_settings" ON public.admin_settings
  FOR SELECT TO authenticated USING (true);

-- Only authenticated can update (admin operations)
CREATE POLICY "authenticated_update_admin_settings" ON public.admin_settings
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. REVOKE COLUMN-LEVEL ACCESS ON password_hash
-- ============================================================

-- Revoke SELECT on admin_password_hash from both anon and authenticated
-- so the hash is never exposed via the API
REVOKE SELECT (admin_password_hash) ON public.admin_settings FROM anon;
REVOKE SELECT (admin_password_hash) ON public.admin_settings FROM authenticated;

-- Grant SELECT on all other columns
GRANT SELECT (id, admin_email, allow_registrations, auto_approve_cards, maintenance_mode, platform_version, created_at, updated_at) ON public.admin_settings TO authenticated;

-- ============================================================
-- 4. REVOKE anon ACCESS ON admin_settings ENTIRELY
-- ============================================================

REVOKE ALL ON public.admin_settings FROM anon;
GRANT SELECT (id, admin_email, allow_registrations, auto_approve_cards, maintenance_mode, platform_version, created_at, updated_at) ON public.admin_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.admin_settings TO authenticated;
