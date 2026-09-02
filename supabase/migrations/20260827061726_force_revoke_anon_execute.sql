/*
# Phase 5: Force revoke anon execute on all SECURITY DEFINER functions

The default grants on the public schema give EXECUTE to anon.
We need to REVOKE from PUBLIC and then GRANT only to authenticated.
*/

-- Revoke all execute from PUBLIC (covers both anon and authenticated)
REVOKE EXECUTE ON FUNCTION public.admin_get_companies() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_invoices() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_payment_attempts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_admin_login(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_company_on_signup(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_invoice_with_attempt(uuid, text, numeric, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_payment_paid(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_payment_failed(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.retry_payment(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_invoice(uuid) FROM PUBLIC;

-- Now grant only to authenticated
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_attempt(uuid, text, numeric, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_paid(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_payment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_companies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_payment_attempts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_suspend_company(uuid, boolean) TO authenticated;

-- handle_new_user is a trigger function — it should NOT be callable by anyone
-- except the trigger. Revoke from PUBLIC and don't grant to anyone.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
