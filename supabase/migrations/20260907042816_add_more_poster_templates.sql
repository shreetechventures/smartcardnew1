/*
# Add more poster templates for hybrid AI engine

1. New Templates
- Corporate Greeting — professional greeting with logo top, hero center, business info bottom
- Festival Sale — large offer with festival hero, decorative footer
- Real Estate Property — property hero with price badge, features, contact footer
- Restaurant Special — food hero with offer badge, menu-style layout
- Recruitment — professional hiring announcement with CTA
- Service Promotion — service-based business with CTA and contact

2. Security
- No RLS changes, only data inserts into existing ai_templates table.
- All templates are system templates (is_system = true).

3. Notes
- Templates use the same JSON template_def structure as existing ones.
- Each template defines element positions for the deterministic renderer.
- Canvas is 1080x1350 (4:5) or 1080x1080 (1:1) depending on use case.
*/

INSERT INTO ai_templates (name, category, industry, occasion, aspect_ratio, is_system, template_def, sort_order)
VALUES
(
  'Corporate Greeting',
  'festival',
  'corporate',
  NULL,
  '4:5',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1350},{"x":80,"y":80,"id":"logo","type":"logo","width":140,"height":80},{"x":700,"y":80,"id":"tagline","type":"text","color":"#ffffff","width":300,"fontSize":24,"textAlign":"right"},{"x":80,"y":250,"id":"hero","type":"image","width":920,"height":600,"borderRadius":16},{"x":80,"y":900,"id":"headline","type":"text","color":"#ffffff","width":920,"fontSize":56,"fontWeight":"bold","textAlign":"center"},{"x":80,"y":1000,"id":"subheadline","type":"text","color":"#ffffff","width":920,"fontSize":32,"textAlign":"center"},{"x":80,"y":1120,"id":"business_name","type":"text","color":"#ffffff","width":700,"fontSize":28,"fontWeight":"bold"},{"x":880,"y":1100,"id":"qr","type":"qr","width":120}]}'::jsonb,
  7
),
(
  'Festival Sale',
  'festival',
  'retail',
  NULL,
  '4:5',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1350},{"x":0,"y":0,"id":"hero","type":"image","width":1080,"height":750},{"x":80,"y":80,"id":"offer_badge","type":"text","color":"#ffffff","width":250,"fontSize":42,"fontWeight":"bold","background":"#ef4444","borderRadius":50,"textAlign":"center","padding":16},{"x":80,"y":800,"id":"offer_text","type":"text","color":"#f59e0b","width":920,"fontSize":80,"fontWeight":"bold","textAlign":"center"},{"x":80,"y":920,"id":"headline","type":"text","color":"#1a1a2e","width":920,"fontSize":44,"fontWeight":"bold","textAlign":"center"},{"x":80,"y":1000,"id":"subheadline","type":"text","color":"#64748b","width":920,"fontSize":28,"textAlign":"center"},{"x":340,"y":1100,"id":"cta","type":"text","color":"#ffffff","width":400,"fontSize":32,"fontWeight":"bold","background":"#5648db","borderRadius":12,"textAlign":"center","padding":20},{"x":80,"y":1230,"id":"business_name","type":"text","color":"#64748b","width":600,"fontSize":24},{"x":880,"y":1210,"id":"qr","type":"qr","width":120}]}'::jsonb,
  8
),
(
  'Real Estate Property',
  'realestate',
  'real_estate',
  NULL,
  '4:5',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1350},{"x":0,"y":0,"id":"hero","type":"image","width":1080,"height":680},{"x":80,"y":80,"id":"price_badge","type":"text","color":"#ffffff","width":300,"fontSize":36,"fontWeight":"bold","background":"#0ea5e9","borderRadius":8,"padding":16},{"x":80,"y":740,"id":"headline","type":"text","color":"#1a1a2e","width":920,"fontSize":48,"fontWeight":"bold"},{"x":80,"y":820,"id":"subheadline","type":"text","color":"#64748b","width":920,"fontSize":28},{"x":80,"y":920,"id":"offer_text","type":"text","color":"#ef4444","width":920,"fontSize":40,"fontWeight":"bold"},{"x":80,"y":1000,"id":"cta","type":"text","color":"#ffffff","width":400,"fontSize":30,"fontWeight":"bold","background":"#5648db","borderRadius":12,"textAlign":"center","padding":18},{"x":80,"y":1150,"id":"business_name","type":"text","color":"#1a1a2e","width":600,"fontSize":28,"fontWeight":"bold"},{"x":80,"y":1220,"id":"phone","type":"text","color":"#64748b","width":600,"fontSize":24},{"x":880,"y":1130,"id":"qr","type":"qr","width":120}]}'::jsonb,
  9
),
(
  'Restaurant Special',
  'restaurant',
  'restaurant',
  NULL,
  '1:1',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1080},{"x":60,"y":60,"id":"hero","type":"image","width":960,"height":560,"borderRadius":16},{"x":60,"y":60,"id":"offer_badge","type":"text","color":"#ffffff","width":200,"fontSize":36,"fontWeight":"bold","background":"#ef4444","borderRadius":50,"textAlign":"center","padding":14},{"x":60,"y":660,"id":"headline","type":"text","color":"#1a1a2e","width":960,"fontSize":48,"fontWeight":"bold","textAlign":"center"},{"x":60,"y":740,"id":"subheadline","type":"text","color":"#64748b","width":960,"fontSize":28,"textAlign":"center"},{"x":340,"y":850,"id":"cta","type":"text","color":"#ffffff","width":400,"fontSize":32,"fontWeight":"bold","background":"#f59e0b","borderRadius":12,"textAlign":"center","padding":18},{"x":60,"y":960,"id":"business_name","type":"text","color":"#1a1a2e","width":600,"fontSize":26,"fontWeight":"bold"},{"x":880,"y":940,"id":"qr","type":"qr","width":120}]}'::jsonb,
  10
),
(
  'Recruitment',
  'recruitment',
  'hr',
  NULL,
  '4:5',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1350},{"x":80,"y":80,"id":"logo","type":"logo","width":120,"height":70},{"x":80,"y":220,"id":"hero","type":"image","width":920,"height":550,"borderRadius":16},{"x":80,"y":820,"id":"headline","type":"text","color":"#ffffff","width":920,"fontSize":52,"fontWeight":"bold"},{"x":80,"y":910,"id":"subheadline","type":"text","color":"#ffffff","width":920,"fontSize":30},{"x":80,"y":1020,"id":"cta","type":"text","color":"#ffffff","width":400,"fontSize":30,"fontWeight":"bold","background":"#0ea5e9","borderRadius":12,"textAlign":"center","padding":18},{"x":80,"y":1160,"id":"business_name","type":"text","color":"#ffffff","width":600,"fontSize":26,"fontWeight":"bold"},{"x":880,"y":1140,"id":"qr","type":"qr","width":120}]}'::jsonb,
  11
),
(
  'Service Promotion',
  'service',
  'professional_services',
  NULL,
  '4:5',
  true,
  '{"elements":[{"x":0,"y":0,"id":"bg","type":"background","width":1080,"height":1350},{"x":80,"y":80,"id":"hero","type":"image","width":920,"height":650,"borderRadius":16},{"x":80,"y":780,"id":"headline","type":"text","color":"#1a1a2e","width":920,"fontSize":48,"fontWeight":"bold"},{"x":80,"y":870,"id":"subheadline","type":"text","color":"#64748b","width":920,"fontSize":28},{"x":80,"y":970,"id":"offer_text","type":"text","color":"#ef4444","width":920,"fontSize":36,"fontWeight":"bold"},{"x":80,"y":1060,"id":"cta","type":"text","color":"#ffffff","width":400,"fontSize":30,"fontWeight":"bold","background":"#5648db","borderRadius":12,"textAlign":"center","padding":18},{"x":80,"y":1180,"id":"business_name","type":"text","color":"#1a1a2e","width":600,"fontSize":26,"fontWeight":"bold"},{"x":80,"y":1240,"id":"phone","type":"text","color":"#64748b","width":600,"fontSize":22},{"x":880,"y":1160,"id":"qr","type":"qr","width":120}]}'::jsonb,
  12
)
ON CONFLICT DO NOTHING;
