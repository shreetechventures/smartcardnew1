/*
# Update plans_config: 1 Smart Card for all plans, hide non-active features

## Changes
- All four plans (Starter, Business, Growth, Pro) now advertise "1 Smart Card" only.
- Removed non-active features from all plan feature lists: Website Builder, AI Studio,
  Team, Marketplace, Leads, Contacts.
- These features are hidden from the user-facing product but NOT deleted from the database
  or codebase — they can be re-enabled in a future version.

## Important
- This is a data-only update to the plans_config table. No schema changes.
- Existing subscriptions are not affected — only what features are advertised.
*/

UPDATE plans_config SET features = ARRAY['1 Smart Card', 'Reviews', 'QR Codes', 'Settings'] WHERE id = 'starter';
UPDATE plans_config SET features = ARRAY['1 Smart Card', 'Analytics', 'Reviews', 'QR Codes', 'Payments', 'Settings'] WHERE id = 'business';
UPDATE plans_config SET features = ARRAY['1 Smart Card', 'Analytics', 'Reviews', 'QR Codes', 'Payments', 'Settings'] WHERE id = 'growth';
UPDATE plans_config SET features = ARRAY['1 Smart Card', 'Analytics', 'Reviews', 'QR Codes', 'Payments', 'Settings', 'Priority Support'] WHERE id = 'pro';
