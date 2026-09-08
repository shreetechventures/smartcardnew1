/*
# Seed starter AI poster frames

1. New Data
- Adds one business-agnostic frame for each starter poster category.
- Frames use local gradient previews until uploaded frame artwork is available.
- Each frame includes canvas dimensions, orientation, and a layout_json structure
  for the image, logo, business name, tagline, contacts, address, and decoration.

2. Security
- Uses the existing poster_frames RLS policies.
- Does not alter or remove user data.
*/

INSERT INTO public.poster_frames (
  category_id,
  name,
  orientation,
  canvas_width,
  canvas_height,
  layout_json
)
SELECT
  c.id,
  v.frame_name,
  v.orientation,
  v.canvas_width,
  v.canvas_height,
  jsonb_build_object(
    'image_area', jsonb_build_object('x', 0, 'y', 0, 'w', 1080, 'h', 760),
    'logo_area', jsonb_build_object('x', 72, 'y', 72, 'w', 140, 'h', 140),
    'business_name_area', jsonb_build_object('x', 72, 'y', 860, 'w', 936, 'h', 70, 'font', 'Inter', 'color', '#172238', 'align', 'left'),
    'tagline_area', jsonb_build_object('x', 72, 'y', 940, 'w', 936, 'h', 48, 'font', 'Inter', 'color', '#64748b', 'align', 'left'),
    'contact_row_area', jsonb_build_object('x', 72, 'y', 1110, 'w', 936, 'h', 52, 'icons', to_jsonb(ARRAY['phone', 'email', 'website'])),
    'address_area', jsonb_build_object('x', 72, 'y', 1190, 'w', 936, 'h', 48),
    'decorative', jsonb_build_object('border_color', '#5648db', 'shape', 'rounded', 'accent_color', '#0ea5e9')
  )
FROM public.poster_categories c
JOIN (VALUES
  ('Festival', 'Festival Celebration', 'portrait', 1080, 1350),
  ('Good Morning', 'Good Morning Greeting', 'square', 1080, 1080),
  ('Business Promotion', 'Business Promotion', 'landscape', 1366, 768),
  ('Condolence', 'Respectful Condolence', 'portrait', 1080, 1350),
  ('Custom', 'Custom Story Poster', 'story', 1080, 1920)
) AS v(category_name, frame_name, orientation, canvas_width, canvas_height)
  ON c.name = v.category_name
WHERE NOT EXISTS (
  SELECT 1
  FROM public.poster_frames existing
  WHERE existing.category_id = c.id
    AND existing.name = v.frame_name
);
