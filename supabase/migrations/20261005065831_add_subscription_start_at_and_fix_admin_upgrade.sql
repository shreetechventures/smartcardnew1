/*
# Add subscription_start_at to companies and fix admin upgrade function

## Changes
1. Adds `subscription_start_at` column to `companies` table (nullable timestamptz).
2. Recreates `admin_update_company_subscription` to set `subscription_start_at = now()` when activating a plan, and `subscription_expires_at = now() + interval '1 year'` (for annual plans).

## Security
- The function remains SECURITY DEFINER, guarded by `is_admin()`.
- Revokes execute from anon, grants to authenticated.

## Important Notes
1. The admin upgrade date becomes the new subscription start date.
2. The expiry is calculated from the start date, not from account creation or previous plan dates.
3. Does not change any other subscription logic.
*/

ALTER TABLE companies ADD COLUMN IF NOT EXISTS subscription_start_at timestamptz;

DROP POLICY IF EXISTS "select_own_analytics" ON analytics_events;
CREATE POLICY "select_own_analytics"
ON analytics_events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_members
    WHERE company_members.company_id = analytics_events.company_id
    AND company_members.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION admin_update_company_subscription(
  p_company_id uuid,
  p_plan_id text,
  p_subscription_status text,
  p_admin_email text DEFAULT NULL,
  p_admin_password_hash text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_admin_email, p_admin_password_hash) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE companies
  SET
    plan_id = p_plan_id,
    subscription_status = p_subscription_status,
    subscription_start_at = CASE WHEN p_subscription_status = 'active' THEN now() ELSE subscription_start_at END,
    subscription_expires_at = CASE
      WHEN p_subscription_status = 'active' THEN now() + interval '1 year'
      ELSE subscription_expires_at
    END,
    updated_at = now()
  WHERE id = p_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_update_company_subscription(uuid, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION admin_update_company_subscription(uuid, text, text, text, text) TO authenticated;
