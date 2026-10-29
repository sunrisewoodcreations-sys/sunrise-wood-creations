-- One row per finished piece. Pickets come out of inventory when a piece is
-- BUILT (not when an order is placed), and each piece remembers what its
-- pickets cost so an order's profit is accurate whenever the piece is sold.
-- order_id is empty while the piece is sitting on the shelf.
-- Additive and safe to run more than once.
create table if not exists built_units (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  cost_cents integer not null default 0,
  pickets_used integer not null default 0,
  allocations jsonb not null default '[]'::jsonb,
  order_id uuid references orders(id) on delete set null,
  order_item_id uuid references order_items(id) on delete set null,
  built_at timestamptz not null default now()
);
create index if not exists built_units_shelf_idx on built_units (product_id, built_at) where order_id is null;
alter table built_units enable row level security;
drop policy if exists "built_units_admin_all" on built_units;
create policy "built_units_admin_all" on built_units for all using (is_admin());
