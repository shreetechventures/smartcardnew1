/*
# Restrict marketplace listing management to admins/owners only

Only company admins, owners, and superadmins can create, edit, or delete
marketplace listings. Regular users (editors, viewers) can only browse.
*/

-- Helper: is the current user an admin or owner of the given company (or a superadmin)?
CREATE OR REPLACE FUNCTION public.is_company_admin(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
    AND user_id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_company_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_company_admin(uuid) TO authenticated;

-- Replace INSERT policy: only admins/owners can create listings
DROP POLICY IF EXISTS "insert_company_marketplace" ON public.marketplace_listings;
CREATE POLICY "insert_company_marketplace" ON public.marketplace_listings FOR INSERT
  TO authenticated WITH CHECK (public.is_company_admin(company_id));

-- Replace UPDATE policy: only admins/owners can edit listings
DROP POLICY IF EXISTS "update_company_marketplace" ON public.marketplace_listings;
CREATE POLICY "update_company_marketplace" ON public.marketplace_listings FOR UPDATE
  TO authenticated USING (public.is_company_admin(company_id)) WITH CHECK (public.is_company_admin(company_id));

-- Replace DELETE policy: only admins/owners can delete listings
DROP POLICY IF EXISTS "delete_company_marketplace" ON public.marketplace_listings;
CREATE POLICY "delete_company_marketplace" ON public.marketplace_listings FOR DELETE
  TO authenticated USING (public.is_company_admin(company_id));
