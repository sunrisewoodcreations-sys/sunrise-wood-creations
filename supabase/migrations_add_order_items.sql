-- Lets one order hold multiple different items (e.g. 2 planter boxes +
-- 1 cutting board), each with its own quantity and price. Orders created
-- before this feature have no rows here and keep working exactly as
-- before, using their existing title/price/quantity fields directly.
create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id),
  title text not null,
  size_details text,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  created_at timestamptz not null default now()
);

alter table order_items enable row level security;

create policy "order_items_select_own_or_admin" on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );

create policy "order_items_admin_write" on order_items
  for all using (is_admin());
