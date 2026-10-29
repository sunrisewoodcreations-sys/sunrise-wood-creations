-- Default low-stock alert level of 2 for every product.
-- 1) New products default to 2.
-- 2) Existing products still at 0 are raised to 2 (anything you already set
--    to another number is left alone).
-- Safe to run more than once.
alter table products alter column low_stock_threshold set default 2;
update products set low_stock_threshold = 2 where coalesce(low_stock_threshold, 0) = 0;
-- Let the alert email fire again for anything now at/below its new line.
update products set low_stock_alert_sent = false where stock_quantity > low_stock_threshold;
