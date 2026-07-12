-- Just the quote_requests table, in case it was missed from the earlier
-- batch migration.
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

drop policy if exists "quote_requests_public_insert" on quote_requests;
create policy "quote_requests_public_insert" on quote_requests
  for insert with check (true);

drop policy if exists "quote_requests_admin_select" on quote_requests;
create policy "quote_requests_admin_select" on quote_requests
  for select using (is_admin());
