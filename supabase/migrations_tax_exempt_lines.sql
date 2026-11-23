-- A line on an order can be marked "no sales tax" (e.g. a separately charged
-- design fee). orders.tax_exempt_cents keeps the sum of those lines so reports
-- can lower the sales tax owed. Safe to run again.
alter table public.order_items add column if not exists tax_exempt boolean not null default false;
alter table public.orders add column if not exists tax_exempt_cents integer not null default 0;
