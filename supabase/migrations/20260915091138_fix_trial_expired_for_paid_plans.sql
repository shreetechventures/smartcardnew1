-- Only show trial expiry for the free 'starter' plan.
-- Paid plans (business, growth, pro) should never show the trial expired message,
-- even if their subscription_status is still 'trial' (e.g. during a paid trial period).

CREATE OR REPLACE FUNCTION is_trial_expired(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN subscription_status = 'trial'
           AND plan_id = 'starter'
           AND trial_started_at IS NOT NULL
      THEN now() > trial_started_at + interval '3 days'
      ELSE false
    END
  FROM companies
  WHERE id = p_company_id;
$$;

CREATE OR REPLACE FUNCTION check_trial_and_card_access(p_company_id uuid, p_card_id uuid)
RETURNS TABLE(is_expired boolean, trial_active boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN c.subscription_status = 'trial'
           AND c.plan_id = 'starter'
           AND c.trial_started_at IS NOT NULL
      THEN now() > c.trial_started_at + interval '3 days'
      ELSE false
    END AS is_expired,
    c.subscription_status = 'trial' AS trial_active
  FROM companies c
  WHERE c.id = p_company_id;
$$;
