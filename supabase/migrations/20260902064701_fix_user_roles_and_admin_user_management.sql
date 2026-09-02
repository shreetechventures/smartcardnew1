/*
# Fix user roles and add admin user management functions

## Changes:
1. Updates create_company_on_signup to assign 'trial_user' role instead of 'owner' for free users
2. Creates admin_update_user_role function - allows admin to change a user's role
3. Creates admin_update_user_status function - allows admin to suspend/activate users
4. Creates admin_delete_user function - allows admin to remove a user from a company
5. Grants anon role execute on all new admin functions

## Security:
- All admin functions verify admin credentials before performing any action
- Functions use the same credential verification pattern as existing admin functions
*/

-- ============================================================
-- 1. Update create_company_on_signup to use 'trial_user' role
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_company_on_signup(p_user_id uuid, p_company_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  INSERT INTO public.companies (name, plan_id, subscription_status)
  VALUES (p_company_name, 'starter', 'trial')
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, p_user_id, 'trial_user');

  RETURN v_company_id;
END;
$$;

-- ============================================================
-- 2. Admin: Update user role
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_role(
  p_user_id uuid,
  p_new_role text,
  p_admin_email text,
  p_admin_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash text;
  v_admin_email text;
BEGIN
  SELECT admin_email, admin_password_hash INTO v_admin_email, v_stored_hash
  FROM public.admin_settings LIMIT 1;

  IF v_admin_email IS NULL OR v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'Admin not configured';
  END IF;

  IF v_admin_email != p_admin_email OR v_stored_hash != p_admin_password_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_new_role NOT IN ('trial_user', 'owner', 'admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.company_members
  SET role = p_new_role, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 3. Admin: Update user status (suspend/activate)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_user_status(
  p_user_id uuid,
  p_new_status text,
  p_admin_email text,
  p_admin_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash text;
  v_admin_email text;
BEGIN
  SELECT admin_email, admin_password_hash INTO v_admin_email, v_stored_hash
  FROM public.admin_settings LIMIT 1;

  IF v_admin_email IS NULL OR v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'Admin not configured';
  END IF;

  IF v_admin_email != p_admin_email OR v_stored_hash != p_admin_password_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_new_status NOT IN ('active', 'suspended', 'inactive') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.company_members
  SET status = p_new_status, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

-- ============================================================
-- 4. Admin: Delete user (remove from company + disable)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id uuid,
  p_admin_email text,
  p_admin_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stored_hash text;
  v_admin_email text;
BEGIN
  SELECT admin_email, admin_password_hash INTO v_admin_email, v_stored_hash
  FROM public.admin_settings LIMIT 1;

  IF v_admin_email IS NULL OR v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'Admin not configured';
  END IF;

  IF v_admin_email != p_admin_email OR v_stored_hash != p_admin_password_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Remove from company_members
  DELETE FROM public.company_members WHERE user_id = p_user_id;

  -- Delete the auth user (this cascades to profiles etc.)
  -- We use auth.admin_delete_user which is available in Supabase
  PERFORM auth.admin_delete_user(p_user_id);

  RETURN true;
END;
$$;

-- ============================================================
-- 5. Grant anon execute on new admin functions
-- ============================================================
GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid, text, text) TO anon, authenticated;
