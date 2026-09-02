/*
# QR code types + routing rules company scoping

1. Add qr_type column to qr_codes: 'card' or 'review'
2. Add company_id to review_routing_rules for per-company routing
3. Add company_id to qr_codes for multi-tenant scoping
*/

-- Add qr_type to qr_codes
ALTER TABLE public.qr_codes ADD COLUMN IF NOT EXISTS qr_type text NOT NULL DEFAULT 'card' CHECK (qr_type IN ('card', 'review'));

-- Add company_id to qr_codes (already added in multi-tenant migration, but ensure)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='qr_codes' AND column_name='company_id') THEN
    ALTER TABLE public.qr_codes ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add company_id to review_routing_rules
ALTER TABLE public.review_routing_rules ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_qr_codes_company_id ON public.qr_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_review_routing_rules_company_id ON public.review_routing_rules(company_id);
