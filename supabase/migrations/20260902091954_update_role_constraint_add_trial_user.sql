-- Add 'trial_user' to the role check constraint and 'inactive' to status check
ALTER TABLE public.company_members DROP CONSTRAINT company_members_role_check;
ALTER TABLE public.company_members ADD CONSTRAINT company_members_role_check
  CHECK (role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'viewer'::text, 'trial_user'::text]));

ALTER TABLE public.company_members DROP CONSTRAINT company_members_status_check;
ALTER TABLE public.company_members ADD CONSTRAINT company_members_status_check
  CHECK (status = ANY (ARRAY['active'::text, 'invited'::text, 'suspended'::text, 'inactive'::text]));

-- Update existing 'owner' roles to 'trial_user' for free users
UPDATE public.company_members SET role = 'trial_user', updated_at = now() WHERE role = 'owner';

-- Update the admin functions to match the new allowed values
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

  IF p_new_status NOT IN ('active', 'suspended', 'inactive', 'invited') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.company_members
  SET status = p_new_status, updated_at = now()
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_status(uuid, text, text, text) TO anon, authenticated;
