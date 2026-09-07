/*
# Trial Expiry Enforcement

1. Changes
- Adds a `trial_started_at` column to `companies` to track when the trial began.
- Adds a database function `is_trial_expired(p_company_id)` that returns true if the company is on trial and 3+ days have passed since `trial_started_at`.
- Adds a function `check_trial_and_card_access(p_company_id, p_card_id)` that returns whether a card should be visible: if the company trial is expired, the card is treated as expired/inactive.

2. Security
- No RLS changes needed — these are SECURITY DEFINER functions callable by authenticated users.
- Functions are read-only (SELECT only, no mutations).

3. Notes
- `trial_started_at` defaults to `created_at` for existing rows so existing trials are measured from company creation.
- The frontend will call `is_trial_expired` to check if cards should show an expired state.
- `check_card_limit` already exists for plan-based card count limits.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN trial_started_at timestamptz DEFAULT now();
    UPDATE companies SET trial_started_at = created_at WHERE trial_started_at IS NULL;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION is_trial_expired(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN subscription_status = 'trial' AND trial_started_at IS NOT NULL
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
      WHEN c.subscription_status = 'trial' AND c.trial_started_at IS NOT NULL
      THEN now() > c.trial_started_at + interval '3 days'
      ELSE false
    END AS is_expired,
    c.subscription_status = 'trial' AS trial_active
  FROM companies c
  WHERE c.id = p_company_id;
$$;
