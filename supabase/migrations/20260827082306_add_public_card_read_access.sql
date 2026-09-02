/*
# Public Card View Access

Allows anyone (including anon) to view active cards and their products
by handle. This is needed for the public digital card page at /card/[handle].

Only active cards are publicly visible. Inactive cards remain private.
*/

-- Allow anon to SELECT active cards
CREATE POLICY "anon_select_active_cards" ON public.cards
  FOR SELECT TO anon USING (status = 'active');

-- Allow anon to SELECT products on active cards
CREATE POLICY "anon_select_products_active_cards" ON public.products
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.cards
      WHERE cards.id = products.card_id
      AND cards.status = 'active'
    )
  );
