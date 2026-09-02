-- Grant anon role permission to call verify_admin_login
-- The admin login page calls this function before the user is authenticated,
-- so anon access is required. The function only returns true/false and does
-- not expose the password hash, so this is safe.
REVOKE EXECUTE ON FUNCTION public.verify_admin_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO anon;