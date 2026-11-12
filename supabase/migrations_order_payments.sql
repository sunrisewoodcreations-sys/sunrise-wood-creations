-- migrations_order_payments.sql
-- One row per payment on an order, so a single order can be paid in several
-- pieces by different methods (e.g. deposit by Venmo, the rest in cash).
-- orders.amount_paid_cents stays as the running total (kept in sync by the
-- app), so every existing screen keeps working. Safe to run again.

create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method text check (method is null or method in ('cash', 'card', 'check', 'venmo', 'zelle')),
  reference text,
  paid_at timestamptz not null default now()
);
create index if not exists order_payments_order_idx on public.order_payments(order_id, paid_at);

alter table public.order_payments enable row level security;
drop policy if exists "order_payments_admin_all" on public.order_payments;
create policy "order_payments_admin_all" on public.order_payments
  for all using (is_admin()) with check (is_admin());

-- Bring existing orders across: whatever was already recorded as paid becomes
-- one payment (with the method it had), once.
insert into public.order_payments (order_id, amount_cents, method, reference, paid_at)
select o.id, o.amount_paid_cents, o.payment_method, o.payment_reference, o.created_at
from public.orders o
where coalesce(o.amount_paid_cents, 0) > 0
  and not exists (select 1 from public.order_payments p where p.order_id = o.id);
