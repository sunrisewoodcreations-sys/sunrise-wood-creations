-- Records exactly which pallet(s) a given order's pickets actually came
-- from, and how many from each — so if that order ever gets deleted, we
-- can add the exact right amount back to the exact right pallet, instead
-- of guessing.
create table if not exists picket_usage_allocations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  purchase_id uuid not null references picket_purchases(id),
  quantity integer not null,
  created_at timestamptz not null default now()
);
alter table picket_usage_allocations enable row level security;
create policy "picket_usage_allocations_admin_only" on picket_usage_allocations
  for all using (is_admin());
