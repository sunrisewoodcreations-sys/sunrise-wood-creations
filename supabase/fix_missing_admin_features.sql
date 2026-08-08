-- Re-applies anything from the earlier "admin features batch" that may
-- have been missed. Every line checks first, so safe to run even if
-- some of this already exists.

-- Profit tracking
alter table products add column if not exists cost_cents integer not null default 0;

-- Due dates
alter table orders add column if not exists due_date date;

-- Low-stock alerts
alter table products add column if not exists low_stock_threshold integer not null default 0;
alter table products add column if not exists low_stock_alert_sent boolean not null default false;

-- Private customer notes
create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
alter table customer_notes enable row level security;
drop policy if exists "customer_notes_admin_only" on customer_notes;
create policy "customer_notes_admin_only" on customer_notes
  for all using (is_admin());
