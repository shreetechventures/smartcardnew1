/*
# AI Creative Studio V2 — Database Foundation

Creates the full table architecture for the AI Creative Studio:
- brand_kits: per-company brand identity (logo, colors, fonts, style)
- ai_templates: structured template definitions with JSON slot layouts
- ai_projects: creative projects that combine templates + assets + business data
- ai_assets: uploaded or generated images belonging to a project
- ai_generation_jobs: queued/processing/completed/failed AI image generation jobs
- ai_creations: final exported creatives (posters, social media, etc.)
- ai_usage: per-company AI operation tracking for billing/limits

All tables are company-scoped with RLS using is_company_member() for access control.
*/

-- ============================================================
-- 1. BRAND KITS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text,
  primary_color text DEFAULT '#5648db',
  secondary_color text DEFAULT '#7c3aed',
  accent_color text DEFAULT '#f59e0b',
  font_family text DEFAULT 'Inter',
  preferred_style text DEFAULT 'professional',
  preferred_language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_brand_kits" ON public.brand_kits;
CREATE POLICY "select_own_brand_kits" ON public.brand_kits FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_brand_kits" ON public.brand_kits;
CREATE POLICY "insert_own_brand_kits" ON public.brand_kits FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "update_own_brand_kits" ON public.brand_kits;
CREATE POLICY "update_own_brand_kits" ON public.brand_kits FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "delete_own_brand_kits" ON public.brand_kits;
CREATE POLICY "delete_own_brand_kits" ON public.brand_kits FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 2. AI TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  industry text,
  occasion text,
  aspect_ratio text NOT NULL DEFAULT '4:5',
  is_system boolean NOT NULL DEFAULT true,
  template_def jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_system_templates" ON public.ai_templates;
CREATE POLICY "read_system_templates" ON public.ai_templates FOR SELECT
  TO anon, authenticated USING (is_system = true);

DROP POLICY IF EXISTS "read_all_templates_auth" ON public.ai_templates;
CREATE POLICY "read_all_templates_auth" ON public.ai_templates FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- 3. AI PROJECTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  prompt text,
  creative_brief jsonb,
  template_id uuid REFERENCES public.ai_templates(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft',
  language text NOT NULL DEFAULT 'en',
  aspect_ratio text NOT NULL DEFAULT '4:5',
  final_image_url text,
  final_composition jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_projects" ON public.ai_projects;
CREATE POLICY "select_own_ai_projects" ON public.ai_projects FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_ai_projects" ON public.ai_projects;
CREATE POLICY "insert_own_ai_projects" ON public.ai_projects FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "update_own_ai_projects" ON public.ai_projects;
CREATE POLICY "update_own_ai_projects" ON public.ai_projects FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "delete_own_ai_projects" ON public.ai_projects;
CREATE POLICY "delete_own_ai_projects" ON public.ai_projects FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 4. AI ASSETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'generated',
  source text NOT NULL DEFAULT 'ai',
  image_url text NOT NULL,
  prompt text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_assets" ON public.ai_assets;
CREATE POLICY "select_own_ai_assets" ON public.ai_assets FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_ai_assets" ON public.ai_assets;
CREATE POLICY "insert_own_ai_assets" ON public.ai_assets FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "delete_own_ai_assets" ON public.ai_assets;
CREATE POLICY "delete_own_ai_assets" ON public.ai_assets FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 5. AI GENERATION JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.ai_projects(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operation text NOT NULL DEFAULT 'image_generation',
  provider text NOT NULL DEFAULT 'gemini',
  model text,
  prompt text NOT NULL,
  enhanced_prompt text,
  status text NOT NULL DEFAULT 'queued',
  result_url text,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_jobs" ON public.ai_generation_jobs;
CREATE POLICY "select_own_ai_jobs" ON public.ai_generation_jobs FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_ai_jobs" ON public.ai_generation_jobs;
CREATE POLICY "insert_own_ai_jobs" ON public.ai_generation_jobs FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "update_own_ai_jobs" ON public.ai_generation_jobs;
CREATE POLICY "update_own_ai_jobs" ON public.ai_generation_jobs FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));

-- ============================================================
-- 6. AI CREATIONS (final exported creatives)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_creations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.ai_projects(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'poster',
  image_url text NOT NULL,
  composition_data jsonb,
  aspect_ratio text NOT NULL DEFAULT '4:5',
  language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_creations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_creations" ON public.ai_creations;
CREATE POLICY "select_own_ai_creations" ON public.ai_creations FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_ai_creations" ON public.ai_creations;
CREATE POLICY "insert_own_ai_creations" ON public.ai_creations FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

DROP POLICY IF EXISTS "delete_own_ai_creations" ON public.ai_creations;
CREATE POLICY "delete_own_ai_creations" ON public.ai_creations FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- ============================================================
-- 7. AI USAGE TRACKING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  operation text NOT NULL,
  model text,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'success',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_ai_usage" ON public.ai_usage;
CREATE POLICY "select_own_ai_usage" ON public.ai_usage FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));

DROP POLICY IF EXISTS "insert_own_ai_usage" ON public.ai_usage;
CREATE POLICY "insert_own_ai_usage" ON public.ai_usage FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));

-- ============================================================
-- 8. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_brand_kits_company ON public.brand_kits(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_projects_company ON public.ai_projects(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_assets_project ON public.ai_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_assets_company ON public.ai_assets(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_company ON public.ai_generation_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_project ON public.ai_generation_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_creations_company ON public.ai_creations(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_company ON public.ai_usage(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_templates_category ON public.ai_templates(category);

-- ============================================================
-- 9. SEED SYSTEM TEMPLATES
-- ============================================================
INSERT INTO public.ai_templates (name, category, industry, occasion, aspect_ratio, is_system, template_def, sort_order) VALUES
('Festival Greeting', 'festival', NULL, NULL, '4:5', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1350},{"id":"hero","type":"image","x":80,"y":80,"width":920,"height":700},{"id":"headline","type":"text","x":80,"y":820,"width":920,"fontSize":56,"fontWeight":"bold","color":"#ffffff"},{"id":"subheadline","type":"text","x":80,"y":900,"width":920,"fontSize":32,"color":"#ffffff"},{"id":"business_name","type":"text","x":80,"y":1100,"width":920,"fontSize":28,"fontWeight":"bold","color":"#ffffff"},{"id":"logo","type":"logo","x":80,"y":1200,"width":120},{"id":"qr","type":"qr","x":880,"y":1180,"width":120}]}',
 1),
('Product Showcase', 'product', NULL, NULL, '4:5', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1350},{"id":"hero","type":"image","x":80,"y":80,"width":920,"height":800},{"id":"offer_badge","type":"text","x":80,"y":80,"width":200,"fontSize":36,"fontWeight":"bold","color":"#ffffff","background":"#ef4444","borderRadius":50},{"id":"headline","type":"text","x":80,"y":920,"width":920,"fontSize":48,"fontWeight":"bold","color":"#1a1a2e"},{"id":"subheadline","type":"text","x":80,"y":1000,"width":920,"fontSize":28,"color":"#64748b"},{"id":"cta","type":"text","x":80,"y":1100,"width":400,"fontSize":32,"fontWeight":"bold","color":"#ffffff","background":"#5648db","borderRadius":12,"padding":20},{"id":"business_name","type":"text","x":80,"y":1250,"width":600,"fontSize":24,"color":"#64748b"},{"id":"qr","type":"qr","x":880,"y":1180,"width":120}]}',
 2),
('Minimal Brand', 'branding', NULL, NULL, '1:1', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1080},{"id":"hero","type":"image","x":100,"y":100,"width":880,"height":600},{"id":"headline","type":"text","x":100,"y":740,"width":880,"fontSize":52,"fontWeight":"bold","color":"#1a1a2e"},{"id":"subheadline","type":"text","x":100,"y":820,"width":880,"fontSize":30,"color":"#64748b"},{"id":"logo","type":"logo","x":100,"y":920,"width":100},{"id":"business_name","type":"text","x":220,"y":940,"width":600,"fontSize":28,"fontWeight":"bold","color":"#1a1a2e"}]}',
 3),
('Offer Promotion', 'offer', NULL, NULL, '4:5', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1350},{"id":"hero","type":"image","x":0,"y":0,"width":1080,"height":700},{"id":"offer_text","type":"text","x":80,"y":740,"width":920,"fontSize":72,"fontWeight":"bold","color":"#ef4444","textAlign":"center"},{"id":"headline","type":"text","x":80,"y":850,"width":920,"fontSize":44,"fontWeight":"bold","color":"#1a1a2e","textAlign":"center"},{"id":"subheadline","type":"text","x":80,"y":930,"width":920,"fontSize":28,"color":"#64748b","textAlign":"center"},{"id":"cta","type":"text","x":340,"y":1050,"width":400,"fontSize":32,"fontWeight":"bold","color":"#ffffff","background":"#5648db","borderRadius":12,"padding":20,"textAlign":"center"},{"id":"business_name","type":"text","x":80,"y":1180,"width":700,"fontSize":24,"color":"#64748b"},{"id":"qr","type":"qr","x":880,"y":1160,"width":120}]}',
 4),
('Review Poster', 'review', NULL, NULL, '4:5', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1350},{"id":"hero","type":"image","x":80,"y":80,"width":920,"height":600},{"id":"stars","type":"text","x":80,"y":720,"width":920,"fontSize":48,"color":"#f59e0b"},{"id":"headline","type":"text","x":80,"y":800,"width":920,"fontSize":44,"fontWeight":"bold","color":"#1a1a2e"},{"id":"subheadline","type":"text","x":80,"y":880,"width":920,"fontSize":28,"color":"#64748b"},{"id":"business_name","type":"text","x":80,"y":1100,"width":600,"fontSize":28,"fontWeight":"bold","color":"#1a1a2e"},{"id":"review_qr","type":"qr","x":880,"y":1080,"width":140,"qrType":"review"},{"id":"logo","type":"logo","x":80,"y":1180,"width":100}]}',
 5),
('Event Announcement', 'event', NULL, NULL, '4:5', true,
 '{"elements":[{"id":"bg","type":"background","x":0,"y":0,"width":1080,"height":1350},{"id":"hero","type":"image","x":80,"y":80,"width":920,"height":650},{"id":"date_badge","type":"text","x":80,"y":770,"width":300,"fontSize":28,"fontWeight":"bold","color":"#ffffff","background":"#5648db","borderRadius":8,"padding":16},{"id":"headline","type":"text","x":80,"y":870,"width":920,"fontSize":52,"fontWeight":"bold","color":"#1a1a2e"},{"id":"subheadline","type":"text","x":80,"y":960,"width":920,"fontSize":30,"color":"#64748b"},{"id":"cta","type":"text","x":80,"y":1080,"width":400,"fontSize":30,"fontWeight":"bold","color":"#ffffff","background":"#5648db","borderRadius":12,"padding":18},{"id":"business_name","type":"text","x":80,"y":1200,"width":600,"fontSize":24,"color":"#64748b"},{"id":"qr","type":"qr","x":880,"y":1180,"width":120}]}',
 6)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 10. Enable anon SELECT on ai_templates (for public template browsing)
-- ============================================================
GRANT SELECT ON public.ai_templates TO anon;
