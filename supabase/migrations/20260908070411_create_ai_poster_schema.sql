/*
# AI Poster Feature — Schema, Storage Buckets, and RLS

1. New Tables
   - `poster_categories`: Festival, Good Morning, Business Promotion, Condolence, Custom, etc.
     Columns: id (uuid pk), name (text), name_local (text for Marathi/Hindi label),
     icon (text — lucide icon name), sort_order (int), is_active (boolean default true).
   - `poster_frames`: design templates that overlay business info on the AI image.
     Columns: id (uuid pk), category_id (fk -> poster_categories), name (text),
     thumbnail_url (text), orientation (text: square|portrait|story|landscape),
     canvas_width (int), canvas_height (int), layout_json (jsonb — business-agnostic
     layout positions for image area, logo, business name, tagline, contact row,
     address, decorative border), is_active (boolean default true).
   - `ai_posters`: generation history per business.
     Columns: id (uuid pk), company_id (fk -> companies), category_id (fk -> poster_categories),
     frame_id (fk -> poster_frames), user_prompt (text), enhanced_prompt (text),
     generated_image_url (text — raw AI image), final_poster_url (text — composited output),
     status (text: generating|generated|composed|completed|failed), created_at (timestamptz default now()).

2. Storage Buckets (public read)
   - `poster-frame-assets`: static svg/png assets used by frame designs.
   - `ai-generated-raw`: raw Gemini output images before frame overlay.
   - `final-posters`: downloaded/composited final poster images.

3. Security (RLS)
   - `poster_categories` and `poster_frames`: readable by all authenticated users (shared catalog).
     Only authenticated users can insert/update/delete (admin-managed).
   - `ai_posters`: owner-scoped via company membership — a business can only read/write
     rows for companies where the user is a member. Uses company_members join.
   - Storage buckets: public read (anon), authenticated write.
*/

-- =========================================================
-- poster_categories
-- =========================================================
CREATE TABLE IF NOT EXISTS public.poster_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_local text,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poster_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_poster_categories" ON public.poster_categories;
CREATE POLICY "read_poster_categories" ON public.poster_categories
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_poster_categories" ON public.poster_categories;
CREATE POLICY "insert_poster_categories" ON public.poster_categories
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_poster_categories" ON public.poster_categories;
CREATE POLICY "update_poster_categories" ON public.poster_categories
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_poster_categories" ON public.poster_categories;
CREATE POLICY "delete_poster_categories" ON public.poster_categories
  FOR DELETE TO authenticated USING (true);

-- =========================================================
-- poster_frames
-- =========================================================
CREATE TABLE IF NOT EXISTS public.poster_frames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.poster_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  thumbnail_url text,
  orientation text NOT NULL DEFAULT 'portrait',
  canvas_width int NOT NULL DEFAULT 1080,
  canvas_height int NOT NULL DEFAULT 1350,
  layout_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.poster_frames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_poster_frames" ON public.poster_frames;
CREATE POLICY "read_poster_frames" ON public.poster_frames
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_poster_frames" ON public.poster_frames;
CREATE POLICY "insert_poster_frames" ON public.poster_frames
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_poster_frames" ON public.poster_frames;
CREATE POLICY "update_poster_frames" ON public.poster_frames
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_poster_frames" ON public.poster_frames;
CREATE POLICY "delete_poster_frames" ON public.poster_frames
  FOR DELETE TO authenticated USING (true);

-- =========================================================
-- ai_posters
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ai_posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.poster_categories(id) ON DELETE SET NULL,
  frame_id uuid REFERENCES public.poster_frames(id) ON DELETE SET NULL,
  user_prompt text,
  enhanced_prompt text,
  generated_image_url text,
  final_poster_url text,
  status text NOT NULL DEFAULT 'generating',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_posters ENABLE ROW LEVEL SECURITY;

-- A user can read posters for companies they belong to
DROP POLICY IF EXISTS "select_own_posters" ON public.ai_posters;
CREATE POLICY "select_own_posters" ON public.ai_posters
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = ai_posters.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- A user can insert posters for companies they belong to
DROP POLICY IF EXISTS "insert_own_posters" ON public.ai_posters;
CREATE POLICY "insert_own_posters" ON public.ai_posters
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = ai_posters.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- A user can update posters for companies they belong to
DROP POLICY IF EXISTS "update_own_posters" ON public.ai_posters;
CREATE POLICY "update_own_posters" ON public.ai_posters
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = ai_posters.company_id
      AND company_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = ai_posters.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- A user can delete posters for companies they belong to
DROP POLICY IF EXISTS "delete_own_posters" ON public.ai_posters;
CREATE POLICY "delete_own_posters" ON public.ai_posters
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_members.company_id = ai_posters.company_id
      AND company_members.user_id = auth.uid()
    )
  );

-- Index for common query: posters by company, newest first
CREATE INDEX IF NOT EXISTS idx_ai_posters_company_created
  ON public.ai_posters (company_id, created_at DESC);

-- =========================================================
-- Storage Buckets
-- =========================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('poster-frame-assets', 'poster-frame-assets', true),
  ('ai-generated-raw', 'ai-generated-raw', true),
  ('final-posters', 'final-posters', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for all three buckets
DROP POLICY IF EXISTS "public_read_poster_frame_assets" ON storage.objects;
CREATE POLICY "public_read_poster_frame_assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'poster-frame-assets');

DROP POLICY IF EXISTS "public_read_ai_generated_raw" ON storage.objects;
CREATE POLICY "public_read_ai_generated_raw" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'ai-generated-raw');

DROP POLICY IF EXISTS "public_read_final_posters" ON storage.objects;
CREATE POLICY "public_read_final_posters" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'final-posters');

-- Authenticated write for all three buckets
DROP POLICY IF EXISTS "auth_write_poster_frame_assets" ON storage.objects;
CREATE POLICY "auth_write_poster_frame_assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'poster-frame-assets');

DROP POLICY IF EXISTS "auth_update_poster_frame_assets" ON storage.objects;
CREATE POLICY "auth_update_poster_frame_assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'poster-frame-assets') WITH CHECK (bucket_id = 'poster-frame-assets');

DROP POLICY IF EXISTS "auth_write_ai_generated_raw" ON storage.objects;
CREATE POLICY "auth_write_ai_generated_raw" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-generated-raw');

DROP POLICY IF EXISTS "auth_update_ai_generated_raw" ON storage.objects;
CREATE POLICY "auth_update_ai_generated_raw" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ai-generated-raw') WITH CHECK (bucket_id = 'ai-generated-raw');

DROP POLICY IF EXISTS "auth_write_final_posters" ON storage.objects;
CREATE POLICY "auth_write_final_posters" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'final-posters');

DROP POLICY IF EXISTS "auth_update_final_posters" ON storage.objects;
CREATE POLICY "auth_update_final_posters" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'final-posters') WITH CHECK (bucket_id = 'final-posters');

-- =========================================================
-- Seed default categories
-- =========================================================
INSERT INTO public.poster_categories (name, name_local, icon, sort_order) VALUES
  ('Festival', 'सण', 'PartyPopper', 1),
  ('Good Morning', 'शुभ सकाळ', 'Sunrise', 2),
  ('Business Promotion', 'व्यवसाय प्रमोशन', 'Megaphone', 3),
  ('Condolence', 'शोक संदेश', 'Flower2', 4),
  ('Custom', 'सानुकूल', 'Sparkles', 5)
ON CONFLICT DO NOTHING;
