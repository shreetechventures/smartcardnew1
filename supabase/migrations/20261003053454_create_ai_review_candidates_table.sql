/*
# Create ai_review_candidates table for one-time-use AI-generated reviews

## Purpose
The current review generation system stores AI reviews as a plain text[] in
review_generation_history and in React state. There is no per-review lifecycle,
no deduplication at the database level, no reservation system, and no
consume-on-copy. This means "Generate More" can return the same reviews, and
copied reviews can be shown again.

This migration creates a new `ai_review_candidates` table that tracks each
individual AI-generated review with a three-state lifecycle:
  available → reserved → used

## Lifecycle
- AVAILABLE: Review exists in DB, never copied, not currently shown to anyone.
- RESERVED: Review is being shown to a specific user (reserved_by, reserved_at).
  Reserved reviews cannot be shown to other users. Reservation expires after
  15 minutes, returning the review to AVAILABLE.
- USED: User clicked Copy. The review is permanently consumed and can NEVER
  return to AVAILABLE or be shown again.

## Uniqueness Scope
- content_hash is UNIQUE per (company_id, content_hash) — two businesses can
  have the same review text but within one business, exact duplicates are
  prevented at the DB level.
- A global uniqueness constraint is NOT enforced because different businesses
  may legitimately share similar review patterns. Per-business uniqueness is
  the correct scope.

## New Tables
- `ai_review_candidates`
  - id (uuid, PK)
  - company_id (uuid, FK → companies, ON DELETE CASCADE)
  - content (text, NOT NULL) — the review text
  - content_hash (text, NOT NULL) — SHA-256 of normalized content
  - rating (int, NOT NULL, CHECK 1-5) — the star rating this was generated for
  - status (text, NOT NULL, DEFAULT 'available', CHECK in available/reserved/used)
  - reserved_by (text, nullable) — anonymous session ID of the reserving user
  - reserved_at (timestamptz, nullable)
  - used_by (text, nullable) — anonymous session ID of the consuming user
  - used_at (timestamptz, nullable)
  - generation_seed (text, nullable) — the seed used for this generation batch
  - ai_model (text, nullable)
  - created_at (timestamptz, DEFAULT now())

## Indexes
- idx_ai_review_candidates_company_status (company_id, status) — fast lookup
- idx_ai_review_candidates_content_hash (company_id, content_hash) — dedup
- idx_ai_review_candidates_reserved_by (reserved_by)
- idx_ai_review_candidates_used_by (used_by)

## Functions
- expire_review_reservations() — moves expired reserved reviews back to available
- reserve_review_candidates(p_company_id, p_count, p_reserved_by) — atomically
  reserves available reviews for a user using FOR UPDATE SKIP LOCKED
- consume_review_candidate(p_review_id, p_used_by) — atomically marks a
  reserved review as used, verifying ownership

## Security
- RLS enabled on ai_review_candidates
- anon + authenticated SELECT (the public review page needs to read candidates
  via the edge function which uses service role key, but anon SELECT is needed
  for the consume RPC to work from the browser)
- No direct INSERT/UPDATE/DELETE from anon — only via SECURITY DEFINER functions
  and the edge function (service role key)
*/

CREATE TABLE IF NOT EXISTS public.ai_review_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content text NOT NULL,
  content_hash text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'used')),
  reserved_by text,
  reserved_at timestamptz,
  used_by text,
  used_at timestamptz,
  generation_seed text,
  ai_model text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_review_candidates ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one business cannot have duplicate content hashes
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_review_candidates_company_content_hash
  ON public.ai_review_candidates (company_id, content_hash);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_ai_review_candidates_company_status
  ON public.ai_review_candidates (company_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_review_candidates_reserved_by
  ON public.ai_review_candidates (reserved_by);

CREATE INDEX IF NOT EXISTS idx_ai_review_candidates_used_by
  ON public.ai_review_candidates (used_by);

-- RLS policies: allow anon+authenticated to SELECT (needed for consume RPC
-- which checks candidate status). INSERT/UPDATE/DELETE only via service role
-- or SECURITY DEFINER functions.
DROP POLICY IF EXISTS "anon_select_ai_review_candidates" ON public.ai_review_candidates;
CREATE POLICY "anon_select_ai_review_candidates"
  ON public.ai_review_candidates FOR SELECT
  TO anon, authenticated USING (true);

-- Function: expire reserved reviews older than 15 minutes
CREATE OR REPLACE FUNCTION public.expire_review_reservations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.ai_review_candidates
  SET status = 'available',
      reserved_by = NULL,
      reserved_at = NULL
  WHERE status = 'reserved'
    AND reserved_at < now() - interval '15 minutes';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Function: reserve review candidates atomically using FOR UPDATE SKIP LOCKED
-- Returns up to p_count available reviews for a company, reserved for p_reserved_by
CREATE OR REPLACE FUNCTION public.reserve_review_candidates(
  p_company_id uuid,
  p_count integer DEFAULT 3,
  p_reserved_by text DEFAULT NULL,
  p_rating integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reserved_by text := COALESCE(p_reserved_by, gen_random_uuid()::text);
  v_results jsonb;
BEGIN
  -- First expire any stale reservations
  PERFORM public.expire_review_reservations();

  -- Atomically reserve available reviews using FOR UPDATE SKIP LOCKED
  -- This prevents two concurrent users from getting the same reviews
  WITH available_reviews AS (
    SELECT id FROM public.ai_review_candidates
    WHERE company_id = p_company_id
      AND status = 'available'
      AND (p_rating IS NULL OR rating = p_rating)
    ORDER BY created_at DESC
    LIMIT p_count
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.ai_review_candidates
  SET status = 'reserved',
      reserved_by = v_reserved_by,
      reserved_at = now()
  WHERE id IN (SELECT id FROM available_reviews)
  RETURNING jsonb_build_object(
    'id', id,
    'content', content,
    'rating', rating
  ) INTO v_results;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;

-- Function: consume a review candidate (mark as USED)
-- Verifies the review is reserved by the requesting user before consuming
CREATE OR REPLACE FUNCTION public.consume_review_candidate(
  p_review_id uuid,
  p_used_by text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.ai_review_candidates
  SET status = 'used',
      used_by = COALESCE(p_used_by, reserved_by),
      used_at = now(),
      reserved_by = NULL,
      reserved_at = NULL
  WHERE id = p_review_id
    AND status = 'reserved';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: release a reservation (when user navigates away without copying)
CREATE OR REPLACE FUNCTION public.release_review_reservation(
  p_reserved_by text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_review_candidates
  SET status = 'available',
      reserved_by = NULL,
      reserved_at = NULL
  WHERE reserved_by = p_reserved_by
    AND status = 'reserved';

  RETURN true;
END;
$$;

-- Function: check if a content_hash already exists for a company
CREATE OR REPLACE FUNCTION public.review_hash_exists(
  p_company_id uuid,
  p_content_hash text
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ai_review_candidates
    WHERE company_id = p_company_id
      AND content_hash = p_content_hash
  );
$$;

-- Grant execute on public functions to anon + authenticated
GRANT EXECUTE ON FUNCTION public.expire_review_reservations() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_review_candidates(uuid, integer, text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_review_candidate(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_review_reservation(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_hash_exists(uuid, text) TO anon, authenticated;
