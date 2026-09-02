/*
# Phase 3: Billing lifecycle functions

Creates SECURITY DEFINER functions for the invoice → payment_attempt →
subscription lifecycle.
*/

-- ============================================================
-- 1. CREATE INVOICE WITH ATTEMPT
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_invoice_with_attempt(
  p_company_id uuid,
  p_plan_id text,
  p_amount numeric,
  p_gateway_order_id text,
  p_currency text DEFAULT 'INR',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invoice_id uuid;
  v_attempt_id uuid;
  v_due_date timestamptz := now() + interval '7 days';
BEGIN
  INSERT INTO public.invoices (company_id, plan_id, amount, currency, status, due_date)
  VALUES (p_company_id, p_plan_id, p_amount, p_currency, 'pending', v_due_date)
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.payment_attempts (
    invoice_id, company_id, gateway_order_id, amount, currency, status
  )
  VALUES (v_invoice_id, p_company_id, p_gateway_order_id, p_amount, p_currency, 'pending')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'invoice_id', v_invoice_id,
    'attempt_id', v_attempt_id,
    'company_id', p_company_id,
    'plan_id', p_plan_id,
    'amount', p_amount,
    'currency', p_currency
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_invoice_with_attempt(uuid, text, numeric, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_invoice_with_attempt(uuid, text, numeric, text, text, uuid) TO authenticated;

-- ============================================================
-- 2. MARK PAYMENT PAID
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_payment_paid(
  p_gateway_order_id text,
  p_gateway_payment_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_attempt RECORD;
  v_invoice_id uuid;
  v_company_id uuid;
  v_plan_id text;
BEGIN
  SELECT * INTO v_attempt
  FROM public.payment_attempts
  WHERE gateway_order_id = p_gateway_order_id
  AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending payment attempt found');
  END IF;

  v_invoice_id := v_attempt.invoice_id;
  v_company_id := v_attempt.company_id;

  UPDATE public.payment_attempts
  SET status = 'paid', gateway_payment_id = p_gateway_payment_id, paid_at = now()
  WHERE id = v_attempt.id;

  SELECT plan_id INTO v_plan_id FROM public.invoices WHERE id = v_invoice_id;

  UPDATE public.invoices
  SET status = 'paid', paid_at = now()
  WHERE id = v_invoice_id;

  UPDATE public.companies
  SET plan_id = v_plan_id,
      subscription_status = 'active',
      subscription_expires_at = now() + interval '1 year',
      updated_at = now()
  WHERE id = v_company_id;

  RETURN jsonb_build_object('success', true, 'invoice_id', v_invoice_id, 'plan_id', v_plan_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_payment_paid(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_payment_paid(text, text) TO authenticated;

-- ============================================================
-- 3. MARK PAYMENT FAILED
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_payment_failed(
  p_gateway_order_id text,
  p_failure_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_attempts
  SET status = 'failed', failure_reason = p_failure_reason
  WHERE gateway_order_id = p_gateway_order_id
  AND status = 'pending';

  UPDATE public.invoices
  SET status = 'failed'
  WHERE id IN (
    SELECT invoice_id FROM public.payment_attempts
    WHERE gateway_order_id = p_gateway_order_id AND status = 'failed'
  )
  AND status = 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.payment_attempts pa
    WHERE pa.invoice_id = invoices.id AND pa.status = 'paid'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_payment_failed(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_payment_failed(text, text) TO authenticated;

-- ============================================================
-- 4. RETRY PAYMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.retry_payment(
  p_invoice_id uuid,
  p_gateway_order_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_attempt_id uuid;
BEGIN
  SELECT * INTO v_invoice FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice already paid');
  END IF;

  IF NOT public.is_company_member(v_invoice.company_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_invoice.status = 'failed' THEN
    UPDATE public.invoices SET status = 'pending' WHERE id = p_invoice_id;
  END IF;

  INSERT INTO public.payment_attempts (
    invoice_id, company_id, gateway_order_id, amount, currency, status
  )
  VALUES (
    p_invoice_id, v_invoice.company_id, p_gateway_order_id,
    v_invoice.amount, v_invoice.currency, 'pending'
  )
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object(
    'success', true,
    'attempt_id', v_attempt_id,
    'invoice_id', p_invoice_id,
    'amount', v_invoice.amount,
    'currency', v_invoice.currency
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.retry_payment(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.retry_payment(uuid, text) TO authenticated;

-- ============================================================
-- 5. CANCEL INVOICE
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_invoice(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
BEGIN
  SELECT company_id INTO v_company_id FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  IF NOT public.is_company_member(v_company_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.invoices SET status = 'cancelled' WHERE id = p_invoice_id AND status IN ('pending', 'failed');
  UPDATE public.payment_attempts SET status = 'cancelled' WHERE invoice_id = p_invoice_id AND status = 'pending';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_invoice(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_invoice(uuid) TO authenticated;

-- ============================================================
-- 6. GRANTS
-- ============================================================

GRANT SELECT, INSERT ON public.invoices TO authenticated;
GRANT SELECT, INSERT ON public.payment_attempts TO authenticated;
GRANT UPDATE ON public.invoices TO authenticated;
GRANT UPDATE ON public.payment_attempts TO authenticated;
