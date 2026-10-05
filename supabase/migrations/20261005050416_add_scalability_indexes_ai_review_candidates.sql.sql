-- Add index for efficient recent-review queries by company
-- This supports the scalable dedup strategy: only fetch recent + used reviews
-- instead of loading all rows into memory for every generation request

CREATE INDEX IF NOT EXISTS idx_ai_review_candidates_company_created
  ON public.ai_review_candidates (company_id, created_at DESC);

-- Index for efficient used-review-only queries (used reviews are the permanent
-- exclusion set; we need to check new candidates against these specifically)
CREATE INDEX IF NOT EXISTS idx_ai_review_candidates_company_used
  ON public.ai_review_candidates (company_id)
  WHERE status = 'used';
