-- Raw-material inventory for the pickets used in planter boxes,
-- specifically (not used for cornhole, signs, or cutting boards).
-- Tracks each pallet/batch you buy, in purchase order, so usage can be
-- costed out FIFO (oldest pickets get used up first).
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
create policy "picket_purchases_admin_only" on picket_purchases
  for all using (is_admin());

-- How many pickets went into a given planter order, and what that
-- actually cost based on FIFO consumption of the purchases above.
alter table orders add column if not exists pickets_used integer;
alter table orders add column if not exists material_cost_cents integer;
