/*
# Revoke anon EXECUTE on SECURITY DEFINER functions

The security advisor flagged that anon can call our SECURITY DEFINER
helper functions. These should only be callable by authenticated users.
*/

REVOKE EXECUTE ON FUNCTION public.create_company_on_signup(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
