-- Creates picket_usage_allocations if it's missing entirely (an earlier
-- migration for this apparently never ran), then adds the newer
-- per-item columns on top.

create table if not exists picket_usage_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  purchase_id uuid not null references picket_purchases(id),
  quantity integer not null,
  created_at timestamptz not null default now()
);
alter table picket_usage_allocations enable row level security;
drop policy if exists "picket_usage_allocations_admin_only" on picket_usage_allocations;
create policy "picket_usage_allocations_admin_only" on picket_usage_allocations
  for all using (is_admin());

-- Per-item picket tracking
alter table order_items add column if not exists product_type text;
alter table order_items add column if not exists pickets_used integer;
alter table order_items add column if not exists material_cost_cents integer;
alter table picket_usage_allocations add column if not exists order_item_id uuid references order_items(id) on delete cascade;
