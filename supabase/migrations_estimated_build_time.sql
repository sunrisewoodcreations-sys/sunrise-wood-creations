-- Estimated active-labor build time per product, in minutes. Deliberately
-- separate from glue cure time (already handled by the 1-day gap between
-- production_date and due_date) — this field is ONLY about hands-on
-- labor, never about drying/curing, which doesn't block starting the
-- next job and shouldn't count toward this number.
alter table products add column if not exists estimated_build_minutes integer;

-- Your stated assumption: 1 hour of active labor per planter box.
-- Only backfills planter products that don't already have a value set
-- (so nothing you've already entered gets overwritten), and leaves
-- every other product type untouched — no assumption was given for
-- those, so they stay honestly "not tracked" until you set them.
update products
set estimated_build_minutes = 60
where product_type = 'planter' and estimated_build_minutes is null;
