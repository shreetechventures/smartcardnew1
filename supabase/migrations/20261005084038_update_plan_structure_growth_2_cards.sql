/*
# Update plan structure: Growth = 2 Smart Cards, hide Pro

## Changes
1. plans_config: Update Growth plan features to "2 Smart Cards" (from "1 Smart Card").
2. plan_limits: Set Growth max_cards = 2 (from 1). Starter and Business remain at 1.
3. Pro plan remains in the database but is hidden from user-facing UIs via the
   `hidden` flag in the frontend plans configuration.

## Card Limit Enforcement
- The check_card_limit() database function reads max_cards from plan_limits.
- Growth: max_cards = 2 (allows 2 cards for the same business)
- Starter: max_cards = 1
- Business: max_cards = 1
- Pro: max_cards = 1 (unchanged, but plan is hidden from users)

## Reviews / QR / Analytics
- Reviews, review templates, QR routing, Google Review destination, and review analytics
  remain business-level (company-level) and shared across all cards under the same company.
- No changes to those systems.
*/

UPDATE plans_config SET features = ARRAY['2 Smart Cards', 'Analytics', 'Reviews', 'QR Codes', 'Payments', 'Settings'] WHERE id = 'growth';

UPDATE plan_limits SET max_cards = 2 WHERE plan_id = 'growth';
