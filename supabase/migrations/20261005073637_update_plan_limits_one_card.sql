/*
# Update plan_limits: set max_cards = 1 for all plans

## Changes
- All plans (Starter, Business, Growth, Pro) now have max_cards = 1.
- This enforces the product decision that every plan includes exactly 1 Smart Card.
- Other limit columns (max_team_members, max_qr_codes, etc.) are left unchanged
  since those features are hidden but not deleted.

## Important
- Data-only update. No schema changes.
- Existing companies with more than 1 card are not affected — the check_card_limit
  function only prevents creating NEW cards beyond the limit.
*/

UPDATE plan_limits SET max_cards = 1 WHERE plan_id IN ('starter', 'business', 'growth', 'pro');
