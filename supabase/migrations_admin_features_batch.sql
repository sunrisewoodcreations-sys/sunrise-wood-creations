-- ============================================================
-- One migration covering all six new admin features. Safe to
-- run once; every statement checks before creating/altering.
-- ============================================================

-- 1. Profit tracking: what each saved product actually costs you to make.
alter table products add column if not exists cost_cents integer not null default 0;

-- 2. Due dates for a build queue.
alter table orders add column if not exists due_date date;

-- 3. Low-stock alerts: per-product threshold, and whether we've already
--    warned you (so you don't get the same email every time it dips).
alter table products add column if not exists low_stock_threshold integer not null default 0;
alter table products add column if not exists low_stock_alert_sent boolean not null default false;

-- 4. Private customer notes — admin-only, customers can never see these.
create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
alter table customer_notes enable row level security;
create policy "customer_notes_admin_only" on customer_notes
  for all using (is_admin());

-- 5. (CSV export needs no schema change — reads existing tables.)

-- 6. Quote requests — public can submit, only admin can read.
create table if not exists quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  product_type text,
  dimensions text,
  wood_type text,
  budget text,
  timeline text,
  description text,
  created_at timestamptz not null default now()
);
alter table quote_requests enable row level security;
create policy "quote_requests_public_insert" on quote_requests
  for insert with check (true);
create policy "quote_requests_admin_select" on quote_requests
  for select using (is_admin());
