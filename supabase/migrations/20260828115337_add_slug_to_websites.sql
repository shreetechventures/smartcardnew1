/*
# Add slug column to websites for public URLs
# Websites will be accessible at /site/[slug]
*/

ALTER TABLE public.websites ADD COLUMN IF NOT EXISTS slug text;

-- Generate slugs for existing websites from site_name
DO $$ BEGIN
  UPDATE public.websites
  SET slug = lower(regexp_replace(site_name, '[^a-zA-Z0-9]+', '-', 'g'))
  WHERE slug IS NULL;
END $$;

-- Make slug unique-ish (append id suffix if duplicates exist)
CREATE UNIQUE INDEX IF NOT EXISTS idx_websites_slug ON public.websites(slug) WHERE slug IS NOT NULL;
