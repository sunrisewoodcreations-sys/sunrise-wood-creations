-- Logs every manual change to a product's stock count, with a reason,
-- so "why did this number change" is always answerable later.
create table if not exists product_stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  old_quantity integer not null,
  new_quantity integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
alter table product_stock_adjustments enable row level security;
create policy "product_stock_adjustments_admin_only" on product_stock_adjustments
  for all using (is_admin());
