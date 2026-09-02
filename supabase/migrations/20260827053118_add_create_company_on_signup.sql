/*
# Auto-create company on signup

When a new user signs up, this function creates a company for them and
makes them the owner. Called from the frontend after auth.signUp succeeds.
*/

CREATE OR REPLACE FUNCTION public.create_company_on_signup(
  p_user_id uuid,
  p_company_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  INSERT INTO public.companies (name, plan_id, subscription_status)
  VALUES (p_company_name, 'starter', 'trial')
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, p_user_id, 'owner');

  RETURN v_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_company_on_signup FROM anon;
GRANT EXECUTE ON FUNCTION public.create_company_on_signup TO authenticated;
