-- Moves picket tracking from the whole order down to each individual
-- line item, since one order can now contain several different planters,
-- each using a different number of pickets.
alter table order_items add column if not exists product_type text;
alter table order_items add column if not exists pickets_used integer;
alter table order_items add column if not exists material_cost_cents integer;

-- Allocations now link to the specific item (order_id kept alongside for
-- convenience — e.g. quickly reversing everything tied to a deleted order).
alter table picket_usage_allocations add column if not exists order_item_id uuid references order_items(id) on delete cascade;
