-- Fix admin_delete_user: auth.admin_delete_user() does not exist in this Supabase instance.
-- Rewrite to delete from all related tables manually, then delete from auth.users directly.

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id uuid,
  p_admin_email text,
  p_admin_password_hash text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_stored_hash text;
  v_admin_email text;
  v_company_id uuid;
BEGIN
  SELECT admin_email, admin_password_hash INTO v_admin_email, v_stored_hash
  FROM public.admin_settings LIMIT 1;

  IF v_admin_email IS NULL OR v_stored_hash IS NULL THEN
    RAISE EXCEPTION 'Admin not configured';
  END IF;

  IF v_admin_email != p_admin_email OR v_stored_hash != p_admin_password_hash THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get the user's company_id before deleting (to clean up company if they're the only member)
  SELECT company_id INTO v_company_id FROM public.company_members WHERE user_id = p_user_id LIMIT 1;

  -- Delete from all tables that reference the user
  DELETE FROM public.ai_generation_jobs WHERE user_id = p_user_id;
  DELETE FROM public.ai_usage WHERE user_id = p_user_id;
  DELETE FROM public.user_feature_overrides WHERE user_id = p_user_id;
  DELETE FROM public.company_members WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM public.user_settings WHERE id = p_user_id;

  -- Delete the auth user directly
  DELETE FROM auth.users WHERE id = p_user_id;

  -- If the user was the only member of their company, clean up the company
  IF v_company_id IS NOT NULL THEN
    DELETE FROM public.companies WHERE id = v_company_id
      AND NOT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = v_company_id);
  END IF;

  RETURN true;
END;
$$;
