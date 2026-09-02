/*
# Phase 2: Team invitations and role security

Adds invitations table, status column on company_members, column-level
security on role, and SECURITY DEFINER functions for role management.
Auto-accepts invitations when invited users sign up.
*/

-- ============================================================
-- 1. ADD STATUS COLUMN TO company_members
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='company_members' AND column_name='status') THEN
    ALTER TABLE public.company_members ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','invited','suspended'));
  END IF;
END $$;

-- ============================================================
-- 2. INVITATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','admin','editor','viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','expired')),
  token text NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_invitations" ON public.invitations;
CREATE POLICY "select_company_invitations" ON public.invitations FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_company_invitations" ON public.invitations;
CREATE POLICY "insert_company_invitations" ON public.invitations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = invitations.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "update_company_invitations" ON public.invitations;
CREATE POLICY "update_company_invitations" ON public.invitations FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = invitations.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = invitations.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );

DROP POLICY IF EXISTS "delete_company_invitations" ON public.invitations;
CREATE POLICY "delete_company_invitations" ON public.invitations FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members cm
      WHERE cm.company_id = invitations.company_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('owner','admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_invitations_company_id ON public.invitations(company_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON public.invitations(token);

-- ============================================================
-- 3. COLUMN-LEVEL SECURITY ON role IN company_members
-- ============================================================

REVOKE UPDATE ON public.company_members FROM authenticated;
GRANT UPDATE (status) ON public.company_members TO authenticated;

-- ============================================================
-- 4. SECURITY DEFINER FUNCTIONS FOR ROLE MANAGEMENT
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_member_role(p_member_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_role NOT IN ('admin','editor','viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.id = p_member_id
    AND EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = cm.company_id
      AND cm2.user_id = auth.uid()
      AND cm2.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.company_members
  SET role = p_role, updated_at = now()
  WHERE id = p_member_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_member_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_member_role(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members cm
    WHERE cm.id = p_member_id
    AND EXISTS (
      SELECT 1 FROM public.company_members cm2
      WHERE cm2.company_id = cm.company_id
      AND cm2.user_id = auth.uid()
      AND cm2.role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF EXISTS (SELECT 1 FROM public.company_members WHERE id = p_member_id AND role = 'owner') THEN
    RAISE EXCEPTION 'Cannot remove the company owner';
  END IF;

  DELETE FROM public.company_members WHERE id = p_member_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.remove_member(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;

-- ============================================================
-- 5. AUTO-ACCEPT INVITATIONS ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  FOR v_invitation IN
    SELECT * FROM public.invitations
    WHERE email = NEW.email
    AND status = 'pending'
  LOOP
    UPDATE public.invitations
    SET status = 'accepted', accepted_at = now()
    WHERE id = v_invitation.id
    AND status = 'pending'
    RETURNING id INTO v_invitation.id;

    IF v_invitation.id IS NOT NULL THEN
      INSERT INTO public.company_members (company_id, user_id, role, status)
      VALUES (v_invitation.company_id, NEW.id, v_invitation.role, 'active')
      ON CONFLICT (company_id, user_id) DO UPDATE SET role = v_invitation.role, status = 'active';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
