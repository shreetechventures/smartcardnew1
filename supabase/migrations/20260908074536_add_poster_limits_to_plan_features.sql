-- Add AI poster generation limits to plan_feature_access
-- Each plan gets a monthly_limit for AI poster generations

UPDATE plan_feature_access
SET features = features || jsonb_build_object('AI Poster', true, 'ai_poster_monthly_limit', 30)
WHERE plan_id = 'pro';

UPDATE plan_feature_access
SET features = features || jsonb_build_object('AI Poster', true, 'ai_poster_monthly_limit', 15)
WHERE plan_id = 'growth';

UPDATE plan_feature_access
SET features = features || jsonb_build_object('AI Poster', false, 'ai_poster_monthly_limit', 0)
WHERE plan_id IN ('starter', 'business');
