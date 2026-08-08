-- A simple chat thread attached to each order, so you and the customer
-- can talk about that specific order.
create table if not exists order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  sender_role text not null check (sender_role in ('admin', 'customer')),
  body text not null,
  created_at timestamptz not null default now()
);

alter table order_messages enable row level security;

create policy "order_messages_select_own_or_admin" on order_messages
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );

create policy "order_messages_insert_own_or_admin" on order_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );
