create table if not exists picket_purchases (
  id uuid primary key default gen_random_uuid(),
  purchased_at date not null default current_date,
  quantity integer not null,
  total_cost_cents integer not null,
  cost_per_picket_cents integer not null,
  remaining_quantity integer not null,
  created_at timestamptz not null default now()
);
alter table picket_purchases enable row level security;

drop policy if exists "picket_purchases_admin_only" on picket_purchases;
create policy "picket_purchases_admin_only" on picket_purchases
  for all using (is_admin());

alter table orders add column if not exists pickets_used integer;
alter table orders add column if not exists material_cost_cents integer;
