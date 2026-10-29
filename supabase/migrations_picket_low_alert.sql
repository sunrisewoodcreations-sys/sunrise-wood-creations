-- Remembers that the "pickets running low" email was already sent, so you get
-- one email per dip instead of one per order. Reset automatically when you
-- log a new pallet. Additive and safe to run more than once.
alter table picket_purchases add column if not exists low_alert_sent boolean not null default false;
