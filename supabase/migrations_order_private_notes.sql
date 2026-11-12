-- migrations_order_private_notes.sql
-- A private, admin-only note per order ("bags on top of order", "shipped"...).
-- Kept in its own table (not a column on orders) so a customer can never
-- read it, even by querying the database directly. Safe to run again.

create table if not exists public.order_private_notes (
  order_id uuid primary key references public.orders(id) on delete cascade,
  note text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.order_private_notes enable row level security;
drop policy if exists "order_private_notes_admin_all" on public.order_private_notes;
create policy "order_private_notes_admin_all" on public.order_private_notes
  for all using (is_admin()) with check (is_admin());
