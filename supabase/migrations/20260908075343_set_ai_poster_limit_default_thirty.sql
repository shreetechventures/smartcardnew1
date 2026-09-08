/*
# Set AI poster monthly limit to 30 for every plan

1. Purpose
- Gives every business plan a default allowance of 30 AI poster generations per calendar month.
- Keeps the limit in `plan_feature_access.features` so the super admin can edit it without another schema change.

2. Modified data
- Updates every existing row in `plan_feature_access` with `AI Poster: true` and `ai_poster_monthly_limit: 30`.
- Adds missing plan rows from `plans_config` without removing any existing feature settings.

3. Security
- No new tables, columns, policies, or permissions are created.
- Existing plan feature access controls remain unchanged.

4. Important notes
- A super admin can change the numeric limit from the Feature Access section.
- Existing feature keys are preserved when the default limit is applied.
*/

INSERT INTO plan_feature_access (plan_id, features)
SELECT id, jsonb_build_object('AI Poster', true, 'ai_poster_monthly_limit', 30)
FROM plans_config
ON CONFLICT (plan_id) DO UPDATE
SET features = plan_feature_access.features || EXCLUDED.features,
    updated_at = now();

UPDATE plan_feature_access
SET features = features || jsonb_build_object('AI Poster', true, 'ai_poster_monthly_limit', 30),
    updated_at = now();
