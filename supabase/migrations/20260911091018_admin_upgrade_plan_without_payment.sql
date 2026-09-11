/*
# Admin can upgrade a company's plan without payment

1. Changes
   - Modified `admin_update_company_subscription` function: when the subscription
     status is set to 'active', the function now also extends
     `subscription_expires_at` to one year from now. This lets an admin
     upgrade any company to a paid plan without requiring a payment.
   - When the status is anything other than 'active', the expiry is left
     unchanged so suspensions and downgrades behave as before.

2. Security
   - No new tables or columns.
   - The function remains SECURITY DEFINER and still checks `public.is_admin()`
     before performing the update, so only authenticated admins can call it.
   - Execute remains granted to `authenticated` only (anon still revoked).
*/

CREATE OR REPLACE FUNCTION public.admin_update_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_subscription_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.companies
  SET plan_id = p_plan_id,
      subscription_status = p_subscription_status,
      subscription_expires_at = CASE
        WHEN p_subscription_status = 'active' THEN now() + interval '1 year'
        ELSE subscription_expires_at
      END,
      updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_update_company_subscription(uuid, text, text) TO authenticated;