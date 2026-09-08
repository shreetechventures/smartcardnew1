-- Create platform_secrets table to store API keys configurable from admin panel
CREATE TABLE IF NOT EXISTS platform_secrets (
  key_name TEXT PRIMARY KEY,
  key_value TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_secret BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT
);

ALTER TABLE platform_secrets ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read (admin panel uses authenticated session)
CREATE POLICY "authenticated_read_secrets" ON platform_secrets
  FOR SELECT TO authenticated USING (true);

-- Only authenticated users can insert/update
CREATE POLICY "authenticated_insert_secrets" ON platform_secrets
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "authenticated_update_secrets" ON platform_secrets
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Seed with known secret names (values empty - will use env fallback until set)
INSERT INTO platform_secrets (key_name, key_value, description, category, is_secret) VALUES
  ('GEMINI_API_KEY', '', 'Google Gemini API key for AI text and image generation', 'ai', true),
  ('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image-preview', 'Gemini image model identifier', 'ai', false),
  ('RAZORPAY_KEY_ID', '', 'Razorpay payment key ID', 'payments', true),
  ('RAZORPAY_KEY_SECRET', '', 'Razorpay payment key secret', 'payments', true),
  ('RAZORPAY_WEBHOOK_SECRET', '', 'Razorpay webhook verification secret', 'payments', true)
ON CONFLICT (key_name) DO NOTHING;
