/*
# Phase 5: Admin login function

Creates a SECURITY DEFINER function that verifies admin credentials
without exposing the password hash through the API. Returns true/false.
*/

CREATE OR REPLACE FUNCTION public.verify_admin_login(p_email text, p_password_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stored_hash text;
BEGIN
  SELECT admin_password_hash INTO v_stored_hash
  FROM public.admin_settings
  WHERE lower(admin_email) = lower(p_email)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN v_stored_hash = p_password_hash;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_admin_login(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_admin_login(text, text) TO authenticated;
