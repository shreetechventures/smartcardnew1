/*
# Auto-add marketplace listing on signup

1. Changes
- Updates create_company_on_signup function to also insert a marketplace_listings
  row for the new company, so every new user automatically appears in the marketplace.
2. Security
- Function remains SECURITY DEFINER, execute granted to authenticated only.
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
  v_user_name text;
BEGIN
  INSERT INTO public.companies (name, plan_id, subscription_status)
  VALUES (p_company_name, 'starter', 'trial')
  RETURNING id INTO v_company_id;

  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (v_company_id, p_user_id, 'owner');

  -- Fetch the user's display name for the marketplace listing
  SELECT COALESCE(raw_user_meta_data->>'full_name', p_company_name)
  INTO v_user_name
  FROM auth.users
  WHERE id = p_user_id;

  -- Auto-create a marketplace listing for the new business
  INSERT INTO public.marketplace_listings (title, category, description, price, creator, status, company_id)
  VALUES (
    COALESCE(v_user_name, p_company_name),
    'service',
    'New business on TheSmartCard platform.',
    0,
    COALESCE(v_user_name, p_company_name),
    'active',
    v_company_id
  )
  ON CONFLICT DO NOTHING;

  RETURN v_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_company_on_signup FROM anon;
GRANT EXECUTE ON FUNCTION public.create_company_on_signup TO authenticated;
