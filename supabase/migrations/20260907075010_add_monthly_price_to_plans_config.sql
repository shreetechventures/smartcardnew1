ALTER TABLE plans_config ADD COLUMN IF NOT EXISTS monthly_price numeric DEFAULT 0;

UPDATE plans_config SET monthly_price = 0 WHERE id = 'starter';
UPDATE plans_config SET monthly_price = 199 WHERE id = 'business';
UPDATE plans_config SET monthly_price = 299 WHERE id = 'growth';
UPDATE plans_config SET monthly_price = 499 WHERE id = 'pro';

UPDATE plans_config SET price = 1999 WHERE id = 'business';
