/*
# Plan limits table

Stores the card limit for each plan. The Starter (free trial) plan
allows 1 card. Business allows 2, Growth 3, Pro 5.
*/

CREATE TABLE IF NOT EXISTS public.plan_limits (
  plan_id text PRIMARY KEY,
  max_cards integer NOT NULL DEFAULT 1,
  max_team_members integer NOT NULL DEFAULT 3,
  max_qr_codes integer NOT NULL DEFAULT 5,
  has_ai_studio boolean NOT NULL DEFAULT false,
  has_custom_domain boolean NOT NULL DEFAULT false,
  has_priority_support boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the plan limits
INSERT INTO public.plan_limits (plan_id, max_cards, max_team_members, max_qr_codes, has_ai_studio, has_custom_domain, has_priority_support) VALUES
  ('starter', 1, 3, 5, false, false, false),
  ('business', 2, 10, 20, false, false, false),
  ('growth', 3, 20, 50, true, true, true),
  ('pro', 5, 50, 100, true, true, true)
ON CONFLICT (plan_id) DO UPDATE SET
  max_cards = EXCLUDED.max_cards,
  max_team_members = EXCLUDED.max_team_members,
  max_qr_codes = EXCLUDED.max_qr_codes,
  has_ai_studio = EXCLUDED.has_ai_studio,
  has_custom_domain = EXCLUDED.has_custom_domain,
  has_priority_support = EXCLUDED.has_priority_support;

-- RLS: anyone can read plan limits (needed for client-side checks)
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_plan_limits" ON public.plan_limits
  FOR SELECT TO anon, authenticated USING (true);

-- SECURITY DEFINER function to check card limit before creating a card
CREATE OR REPLACE FUNCTION public.check_card_limit(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_plan_id text;
  v_max_cards integer;
  v_current_cards integer;
BEGIN
  SELECT c.plan_id INTO v_plan_id
  FROM public.companies c
  WHERE c.id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Company not found');
  END IF;

  SELECT pl.max_cards INTO v_max_cards
  FROM public.plan_limits pl
  WHERE pl.plan_id = v_plan_id;

  IF v_max_cards IS NULL THEN
    v_max_cards := 1;
  END IF;

  SELECT count(*) INTO v_current_cards
  FROM public.cards
  WHERE company_id = p_company_id;

  RETURN jsonb_build_object(
    'allowed', v_current_cards < v_max_cards,
    'max_cards', v_max_cards,
    'current_cards', v_current_cards,
    'plan_id', v_plan_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_card_limit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_card_limit(uuid) TO authenticated;
