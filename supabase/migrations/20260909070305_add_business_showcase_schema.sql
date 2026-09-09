/*
# Business Showcase Schema — Phase 1 & 2

## Purpose
Upgrades TheSmartCard from a digital visiting card into a business growth platform.
Adds business showcase content (services, gallery, certificates, clients, testimonials, statistics)
and lead generation features (quote enquiries, callback requests, smart WhatsApp actions).

## New Tables

1. **business_services** — Services offered by a business (name, description, image, starting price, CTA label/link, sort order, enabled)
2. **business_gallery** — Gallery/portfolio images (image URL, title, description, sort order, enabled)
3. **business_certificates** — Certificates/awards/licenses (image, name, issuing org, year, sort order, enabled)
4. **business_clients** — Trusted-by client logos (name, logo URL, description, sort order, enabled)
5. **business_testimonials** — Customer testimonials (customer name, text, rating, avatar, sort order, enabled)
6. **business_statistics** — Custom business stats (value, label, icon, sort order, enabled)
7. **callback_requests** — Customer callback requests (name, phone, preferred time, message, status, card_id, company_id)
8. **quote_enquiries** — Get-a-Quote form submissions (name, phone, email, requirement, message, preferred contact method, card_id, company_id, status)

## Security
- All tables have RLS enabled
- Business content tables (services, gallery, certificates, clients, testimonials, statistics): authenticated users can CRUD their own company's data; anon can SELECT (for public card display)
- callback_requests & quote_enquiries: anon can INSERT (customers submit from public card); authenticated can SELECT/UPDATE/DELETE (business owners manage)
- All tables scoped by company_id with is_company_member() check
*/

-- 1. Business Services
CREATE TABLE IF NOT EXISTS business_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  starting_price numeric,
  cta_label text DEFAULT 'Get Quote',
  cta_link text,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_services_company ON business_services(company_id);

DROP POLICY IF EXISTS "select_business_services" ON business_services;
CREATE POLICY "select_business_services" ON business_services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_services" ON business_services;
CREATE POLICY "insert_business_services" ON business_services FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_services" ON business_services;
CREATE POLICY "update_business_services" ON business_services FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_services" ON business_services;
CREATE POLICY "delete_business_services" ON business_services FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 2. Business Gallery
CREATE TABLE IF NOT EXISTS business_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  title text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_gallery ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_gallery_company ON business_gallery(company_id);

DROP POLICY IF EXISTS "select_business_gallery" ON business_gallery;
CREATE POLICY "select_business_gallery" ON business_gallery FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_gallery" ON business_gallery;
CREATE POLICY "insert_business_gallery" ON business_gallery FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_gallery" ON business_gallery;
CREATE POLICY "update_business_gallery" ON business_gallery FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_gallery" ON business_gallery;
CREATE POLICY "delete_business_gallery" ON business_gallery FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 3. Business Certificates
CREATE TABLE IF NOT EXISTS business_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  image_url text,
  name text NOT NULL,
  issuing_organization text,
  year int,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_certificates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_certificates_company ON business_certificates(company_id);

DROP POLICY IF EXISTS "select_business_certificates" ON business_certificates;
CREATE POLICY "select_business_certificates" ON business_certificates FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_certificates" ON business_certificates;
CREATE POLICY "insert_business_certificates" ON business_certificates FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_certificates" ON business_certificates;
CREATE POLICY "update_business_certificates" ON business_certificates FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_certificates" ON business_certificates;
CREATE POLICY "delete_business_certificates" ON business_certificates FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 4. Business Clients
CREATE TABLE IF NOT EXISTS business_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  logo_url text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_clients ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_clients_company ON business_clients(company_id);

DROP POLICY IF EXISTS "select_business_clients" ON business_clients;
CREATE POLICY "select_business_clients" ON business_clients FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_clients" ON business_clients;
CREATE POLICY "insert_business_clients" ON business_clients FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_clients" ON business_clients;
CREATE POLICY "update_business_clients" ON business_clients FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_clients" ON business_clients;
CREATE POLICY "delete_business_clients" ON business_clients FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 5. Business Testimonials
CREATE TABLE IF NOT EXISTS business_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  testimonial_text text NOT NULL,
  rating int DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  avatar_url text,
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_testimonials ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_testimonials_company ON business_testimonials(company_id);

DROP POLICY IF EXISTS "select_business_testimonials" ON business_testimonials;
CREATE POLICY "select_business_testimonials" ON business_testimonials FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_testimonials" ON business_testimonials;
CREATE POLICY "insert_business_testimonials" ON business_testimonials FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_testimonials" ON business_testimonials;
CREATE POLICY "update_business_testimonials" ON business_testimonials FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_testimonials" ON business_testimonials;
CREATE POLICY "delete_business_testimonials" ON business_testimonials FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 6. Business Statistics
CREATE TABLE IF NOT EXISTS business_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  stat_value text NOT NULL,
  stat_label text NOT NULL,
  icon text DEFAULT 'award',
  sort_order int NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_statistics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_business_statistics_company ON business_statistics(company_id);

DROP POLICY IF EXISTS "select_business_statistics" ON business_statistics;
CREATE POLICY "select_business_statistics" ON business_statistics FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "insert_business_statistics" ON business_statistics;
CREATE POLICY "insert_business_statistics" ON business_statistics FOR INSERT
  TO authenticated WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "update_business_statistics" ON business_statistics;
CREATE POLICY "update_business_statistics" ON business_statistics FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_business_statistics" ON business_statistics;
CREATE POLICY "delete_business_statistics" ON business_statistics FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 7. Callback Requests
CREATE TABLE IF NOT EXISTS callback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  preferred_time text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','contacted','completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE callback_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_callback_requests_company ON callback_requests(company_id);

DROP POLICY IF EXISTS "select_callback_requests" ON callback_requests;
CREATE POLICY "select_callback_requests" ON callback_requests FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS "insert_callback_requests" ON callback_requests;
CREATE POLICY "insert_callback_requests" ON callback_requests FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_callback_requests" ON callback_requests;
CREATE POLICY "update_callback_requests" ON callback_requests FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_callback_requests" ON callback_requests;
CREATE POLICY "delete_callback_requests" ON callback_requests FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));

-- 8. Quote Enquiries
CREATE TABLE IF NOT EXISTS quote_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  requirement text,
  message text,
  preferred_contact text DEFAULT 'whatsapp' CHECK (preferred_contact IN ('whatsapp','call','email')),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','follow_up','converted','lost')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE quote_enquiries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_quote_enquiries_company ON quote_enquiries(company_id);

DROP POLICY IF EXISTS "select_quote_enquiries" ON quote_enquiries;
CREATE POLICY "select_quote_enquiries" ON quote_enquiries FOR SELECT
  TO authenticated USING (public.is_company_member(company_id));
DROP POLICY IF EXISTS "insert_quote_enquiries" ON quote_enquiries;
CREATE POLICY "insert_quote_enquiries" ON quote_enquiries FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_quote_enquiries" ON quote_enquiries;
CREATE POLICY "update_quote_enquiries" ON quote_enquiries FOR UPDATE
  TO authenticated USING (public.is_company_member(company_id)) WITH CHECK (public.is_company_member(company_id));
DROP POLICY IF EXISTS "delete_quote_enquiries" ON quote_enquiries;
CREATE POLICY "delete_quote_enquiries" ON quote_enquiries FOR DELETE
  TO authenticated USING (public.is_company_member(company_id));