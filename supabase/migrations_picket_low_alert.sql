-- Remembers which "pickets running low" email was already sent (0 = none,
-- 1 = the 100-picket warning, 2 = the 50-picket warning), so you get one email
-- per level instead of one per order. Re-arms when you log a new pallet.
-- Additive and safe to run more than once.
alter table picket_purchases add column if not exists low_alert_level integer not null default 0;
