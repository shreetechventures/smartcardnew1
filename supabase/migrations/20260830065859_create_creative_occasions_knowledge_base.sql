/*
# Creative Occasions Knowledge Base

Creates a knowledge base of Indian festivals and occasions that the AI Creative Planner
uses to generate accurate, culturally-appropriate visual prompts. Instead of the AI
guessing what "Diwali" looks like, it pulls structured visual elements, colors, and
composition rules from this table.

This fixes the problem where "Diwali" produced generic concert/festival images instead
of diyas, rangoli, warm golden lighting, etc.

## Table: creative_occasions
- name: Display name (e.g. "Diwali")
- slug: URL-safe identifier (e.g. "diwali")
- category: festival | national | religious | seasonal | business
- visual_elements: JSON array of visual elements to include in the image prompt
- negative_elements: JSON array of things to explicitly avoid
- preferred_colors: JSON array of color palettes
- composition_rules: JSON object with layout guidance (negative_space, subject_position, etc.)
- prompt_guidelines: Additional text instructions for the image generator
- is_active: Whether this occasion is available for selection
*/

CREATE TABLE IF NOT EXISTS public.creative_occasions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'festival',
  visual_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  negative_elements jsonb NOT NULL DEFAULT '[]'::jsonb,
  preferred_colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  composition_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  prompt_guidelines text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.creative_occasions ENABLE ROW LEVEL SECURITY;

-- Public read access (both anon and authenticated can browse occasions)
DROP POLICY IF EXISTS "read_creative_occasions" ON public.creative_occasions;
CREATE POLICY "read_creative_occasions" ON public.creative_occasions FOR SELECT
  TO anon, authenticated USING (is_active = true);

GRANT SELECT ON public.creative_occasions TO anon;

-- ============================================================
-- SEED: Indian Festivals & Occasions
-- ============================================================
INSERT INTO public.creative_occasions (name, slug, category, visual_elements, negative_elements, preferred_colors, composition_rules, prompt_guidelines, sort_order) VALUES

-- DIWALI
('Diwali', 'diwali', 'festival',
 '["traditional clay diyas with glowing flames", "intricate rangoli designs with vibrant colors", "marigold flower garlands", "warm golden candlelight", "decorative oil lamps", "festive Indian home or office interior", "sparkling bokeh lights in background", "Indian festive decorations", "brass lamps", "rose petals"]',
 '["concert", "music festival", "stage", "large crowd", "random event", "watermark", "text", "logo", "Western setting", "non-Indian decor", "neon lights", "nightclub"]',
 '["#FFA500", "#FFD700", "#FF6B35", "#D4AF37", "#8B4513", "#FF1744"]',
 '{"negative_space": "top or right side for text overlay", "subject_position": "center or left", "lighting": "warm golden glow from diyas", "mood": "warm, premium, celebratory"}',
 'Generate a premium Indian Diwali scene. The atmosphere should be warm and golden with soft candlelight from diyas. Include traditional Indian festive elements. Leave clean negative space for text overlay. Professional commercial photography style.',
 1),

-- HOLI
('Holi', 'holi', 'festival',
 '["colored powder (gulal) in vibrant colors", "people celebrating with colors", "Indian traditional clothing", "water balloons and pichkari", "joyful expressions", "colored powder in the air", "Indian street or courtyard celebration", "white clothes with color stains", "festive Indian atmosphere"]',
 '["concert", "stage", "formal event", "watermark", "text", "logo", "non-Indian setting", "dark mood", "sad expressions"]',
 '["#FF1744", "#00E676", "#FFD600", "#2979FF", "#FF6B35", "#E040FB"]',
 '{"negative_space": "bottom or top for text overlay", "subject_position": "center", "lighting": "bright daylight", "mood": "joyful, vibrant, energetic"}',
 'Generate a vibrant Holi celebration scene with colored powder in the air. Joyful Indian people celebrating. Bright, energetic atmosphere. Leave space for text overlay. Professional photography style.',
 2),

-- RAKSHA BANDHAN
('Raksha Bandhan', 'raksha-bandhan', 'festival',
 '["brother and sister together", "rakhi thread on wrist", "Indian traditional clothing", "sister tying rakhi", "gifts and sweets (laddoo)", "Indian family setting", "warm emotional moment", "tilak on forehead", "Indian festive decor"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-Indian setting", "formal event"]',
 '["#FF1744", "#FFD600", "#FF6B35", "#8B4513", "#FF80AB"]',
 '{"negative_space": "top or bottom for text", "subject_position": "center", "lighting": "warm natural light", "mood": "emotional, warm, family"}',
 'Generate a warm Raksha Bandhan scene showing a brother and sister. Indian family setting with rakhi, sweets, and traditional decor. Emotional and heartwarming. Leave space for text overlay.',
 3),

-- INDEPENDENCE DAY
('Independence Day', 'independence-day', 'national',
 '["Indian tricolor flag (saffron, white, green)", "patriotic Indian setting", "Indian landmarks (India Gate, Red Fort)", "Indian citizens celebrating", "tricolor balloons", "patriotic decorations", "Ashoka Chakra motif", "Indian map silhouette", "freedom fighters portrait style"]',
 '["concert", "music festival", "non-Indian flag", "watermark", "text", "logo", "random crowd", "Western setting"]',
 '["#FF9933", "#FFFFFF", "#138808", "#000080", "#FF6B35"]',
 '{"negative_space": "bottom or top for text", "subject_position": "center", "lighting": "bright daylight", "mood": "patriotic, proud, dignified"}',
 'Generate a patriotic Indian Independence Day scene. Include the Indian tricolor prominently. Dignified and proud atmosphere. Indian landmarks or patriotic settings. Leave space for text overlay.',
 4),

-- EID
('Eid', 'eid', 'religious',
 '["Eid moon (crescent)", "Indian Muslim family celebration", "traditional Indian Muslim attire", "sheer khurma and sweets", "mosque silhouette in background", "embracing hands (Eid Mubarak)", "festive Indian Muslim home decor", "stars and crescent decorations"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-festive setting", "Western setting"]',
 '["#2E7D32", "#FFD700", "#1565C0", "#8B4513", "#C0C0C0"]',
 '{"negative_space": "top or bottom for text", "subject_position": "center", "lighting": "soft evening light with moon", "mood": "peaceful, celebratory, spiritual"}',
 'Generate a peaceful Eid celebration scene. Include crescent moon, Indian Muslim family, traditional sweets. Warm and spiritual atmosphere. Leave space for text overlay.',
 5),

-- CHRISTMAS
('Christmas', 'christmas', 'religious',
 '["Christmas tree with decorations", "warm string lights", "gift boxes with ribbons", "snow or winter setting", "red and green color scheme", "candles and ornaments", "Indian Christmas celebration", "star on top of tree", "festive indoor setting"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-festive setting"]',
 '["#D32F2F", "#388E3C", "#FFD700", "#FFFFFF", "#C62828"]',
 '{"negative_space": "bottom for text", "subject_position": "center", "lighting": "warm indoor lighting", "mood": "cozy, festive, warm"}',
 'Generate a warm Christmas scene with decorated tree, gifts, and string lights. Cozy festive atmosphere. Leave space for text overlay. Professional commercial photography.',
 6),

-- NEW YEAR
('New Year', 'new-year', 'seasonal',
 '["fireworks in the sky", "celebration with confetti", "champagne or sparkling drinks", "clock showing midnight", "festive balloons", "golden bokeh lights", "celebratory atmosphere", "Indian New Year party setting", "2026 text in lights (decorative only)"]',
 '["concert stage", "random crowd", "watermark", "logo", "non-celebratory setting"]',
 '["#FFD700", "#FF1744", "#2979FF", "#FFD600", "#C0C0C0"]',
 '{"negative_space": "center or bottom for text", "subject_position": "background", "lighting": "festive night with fireworks", "mood": "celebratory, exciting, hopeful"}',
 'Generate a New Year celebration scene with fireworks, confetti, and golden lights. Exciting and hopeful atmosphere. Leave clean space for text overlay.',
 7),

-- GANESH CHATURTHI
('Ganesh Chaturthi', 'ganesh-chaturthi', 'festival',
 '["Ganesh idol decorated with flowers", "marigold garlands", "Indian festive mandap", "modak sweets", "traditional Indian decor", "warm lighting", "red and yellow flowers", "Indian temple or home setting", "festive aarti atmosphere"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-Indian setting", "non-Hindu elements"]',
 '["#FF6B35", "#FFD700", "#FF1744", "#8B4513", "#FF80AB"]',
 '{"negative_space": "top or sides for text", "subject_position": "center", "lighting": "warm devotional lighting", "mood": "devotional, festive, reverent"}',
 'Generate a Ganesh Chaturthi scene with decorated Ganesh idol, marigold garlands, and modak sweets. Indian festive mandap setting. Devotional and celebratory atmosphere. Leave space for text overlay.',
 8),

-- NAVRATRI / DURGA PUJA
('Navratri', 'navratri', 'festival',
 '["Garba dance with colorful traditional attire", "Durga idol or imagery", "Indian women in chaniya choli", "colorful dupattas flowing", "dandiya sticks", "festive Indian dance setting", "warm decorative lighting", "Indian traditional music instruments"]',
 '["concert", "Western dance", "stage", "watermark", "text", "logo", "non-Indian setting"]',
 '["#FF1744", "#FFD600", "#FF6B35", "#8B4513", "#E040FB"]',
 '{"negative_space": "top or bottom for text", "subject_position": "center", "lighting": "warm festive lighting", "mood": "energetic, devotional, colorful"}',
 'Generate a Navratri Garba celebration scene with colorful traditional Indian attire, dandiya sticks, and festive dance. Energetic and colorful atmosphere. Leave space for text overlay.',
 9),

-- ONAM
('Onam', 'onam', 'festival',
 '["Onam pookalam (flower rangoli)", "Kerala traditional setting", "banana leaves and feast", "Kerala saree and mundu", "Kathakali face", "backwaters and palm trees", "marigold and jasmine flowers", "Kerala festive decor"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-Kerala setting"]',
 '["#FFD700", "#FF6B35", "#388E3C", "#FF1744", "#FF80AB"]',
 '{"negative_space": "top or sides for text", "subject_position": "center", "lighting": "warm tropical light", "mood": "festive, traditional, Kerala"}',
 'Generate an Onam celebration scene with pookalam flower rangoli, Kerala traditional elements, and festive decor. Traditional and warm atmosphere. Leave space for text overlay.',
 10),

-- PONGAL
('Pongal', 'pongal', 'festival',
 '["Pongal pot with sugarcane", "Tamil traditional decor", "kolam (rice flour rangoli)", "sugarcane fields", "Tamil festive setting", "cows and cattle decorated", "traditional Pongal sweet pot", "South Indian village atmosphere"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-Tamil setting"]',
 '["#FFD700", "#FF6B35", "#388E3C", "#FF1744", "#8B4513"]',
 '{"negative_space": "top or sides for text", "subject_position": "center", "lighting": "warm sunlight", "mood": "harvest, festive, rural"}',
 'Generate a Pongal harvest festival scene with traditional pot, sugarcane, and kolam. South Indian rural festive atmosphere. Leave space for text overlay.',
 11),

-- BHAI DOOJ
('Bhai Dooj', 'bhai-dooj', 'festival',
 '["brother and sister together", "tilak on forehead", "Indian traditional clothing", "sweets and gifts", "Indian family setting", "warm emotional moment", "diya or candle", "Indian festive decor"]',
 '["concert", "crowd", "stage", "watermark", "text", "logo", "non-Indian setting"]',
 '["#FF1744", "#FFD600", "#FF6B35", "#FF80AB"]',
 '{"negative_space": "top or bottom for text", "subject_position": "center", "lighting": "warm indoor light", "mood": "warm, family, emotional"}',
 'Generate a warm Bhai Dooj scene with brother and sister, tilak ceremony, and Indian family setting. Emotional and festive. Leave space for text overlay.',
 12),

-- GENERAL BUSINESS
('Business Promotion', 'business-promotion', 'business',
 '["professional office environment", "clean modern workspace", "business team or professional person", "modern corporate setting", "clean minimal background", "professional lighting", "Indian business context"]',
 '["concert", "festival", "crowd", "watermark", "text", "logo", "cluttered background", "casual setting"]',
 '["#5648db", "#0ea5e9", "#1a1a2e", "#f8f9fc"]',
 '{"negative_space": "right or bottom for text", "subject_position": "left or center", "lighting": "professional studio lighting", "mood": "professional, clean, modern"}',
 'Generate a professional business promotion visual. Clean modern office or corporate setting. Professional lighting. Leave significant clean space for text and logo overlay.',
 13),

-- PRODUCT SHOWCASE
('Product Showcase', 'product-showcase', 'business',
 '["product on clean surface", "studio product photography", "softbox lighting", "minimal background", "product centered", "professional e-commerce style", "subtle shadow", "clean white or gradient background"]',
 '["people", "crowd", "cluttered background", "watermark", "text", "logo", "busy scene", "outdoor"]',
 '["#FFFFFF", "#F8F9FC", "#5648db", "#0ea5e9"]',
 '{"negative_space": "top and bottom for text", "subject_position": "center", "lighting": "studio softbox lighting", "mood": "clean, premium, minimal"}',
 'Generate a premium product photography visual. Clean background, studio lighting, product centered. Leave space for text overlay. E-commerce style.',
 14),

-- OFFER / SALE
('Sale / Offer', 'sale-offer', 'business',
 '["shopping bags and tags", "discount sale atmosphere", "retail shopping scene", "colorful sale elements", "Indian retail setting", "shopping celebration", "gift boxes", "festive shopping decor"]',
 '["empty store", "watermark", "text", "logo", "dark mood", "non-retail setting"]',
 '["#FF1744", "#FFD600", "#FF6B35", "#5648db", "#FF80AB"]',
 '{"negative_space": "center for large offer text", "subject_position": "background", "lighting": "bright and vibrant", "mood": "exciting, promotional, urgent"}',
 'Generate a sale/offer promotional visual. Shopping bags, discount atmosphere, vibrant colors. Exciting promotional mood. Leave large clean center space for offer text overlay.',
 15)

ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_creative_occasions_slug ON public.creative_occasions(slug);
CREATE INDEX IF NOT EXISTS idx_creative_occasions_category ON public.creative_occasions(category);
