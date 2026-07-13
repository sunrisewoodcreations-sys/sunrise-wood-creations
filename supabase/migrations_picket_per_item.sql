-- Moves picket usage tracking from the whole order down to each
-- individual item, since a single order can now have multiple planters
-- that each used a different number of pickets.
alter table order_items add column if not exists product_type text;
alter table order_items add column if not exists pickets_used integer;
alter table order_items add column if not exists material_cost_cents integer;

-- Lets an allocation record point at a specific item, not just an order
-- (old orders without item-level data keep working via order_id alone).
alter table picket_usage_allocations add column if not exists order_item_id uuid references order_items(id) on delete cascade;
