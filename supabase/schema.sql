-- ============================================================
-- Sunrise Wood Creations — database schema
-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
-- ============================================================

-- ---------- PROFILES ----------
-- One row per person who can log in (you = admin, or a customer).
-- Linked 1:1 to Supabase's built-in auth.users table.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null,
  role text not null default 'customer' check (role in ('admin','customer')),
  phone text,
  created_at timestamptz not null default now()
);

-- ---------- ALLOWED EMAILS (the gate) ----------
-- An email must exist here, added by you, before that person can ever get an account.
-- This is what "customer can't sign up on their own" actually enforces.
create table if not exists allowed_emails (
  email text primary key,
  full_name text not null,
  invited_at timestamptz not null default now(),
  used boolean not null default false
);

-- ---------- ORDERS ----------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  product_type text not null check (product_type in ('cornhole','sign','planter','cutting_board')),
  title text not null,
  details text,
  size_details text,
  price_cents integer not null default 0,
  status text not null default 'order_placed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every status change is logged here, both for the progress bar and for a paper trail.
create table if not exists order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  status text not null,
  changed_at timestamptz not null default now()
);

-- ---------- PROOFS (cornhole design approval) ----------
create table if not exists proofs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  image_url text not null,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested')),
  feedback text,
  sent_at timestamptz not null default now(),
  responded_at timestamptz
);

-- ---------- Keep updated_at fresh on orders ----------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_set_updated_at on orders;
create trigger orders_set_updated_at
before update on orders
for each row execute function set_updated_at();

-- ---------- Auto-log status history whenever an order's status changes ----------
create or replace function log_order_status()
returns trigger as $$
begin
  if (tg_op = 'INSERT') or (new.status is distinct from old.status) then
    insert into order_status_history (order_id, status) values (new.id, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists orders_log_status on orders;
create trigger orders_log_status
after insert or update on orders
for each row execute function log_order_status();

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_status_history enable row level security;
alter table proofs enable row level security;
alter table allowed_emails enable row level security;

-- Helper: is the current logged-in user an admin?
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- profiles: people can see their own profile; admins see everyone
create policy "profiles_select_own_or_admin" on profiles
  for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());

-- orders: customers see only their own; admins see/manage everything
create policy "orders_select_own_or_admin" on orders
  for select using (customer_id = auth.uid() or is_admin());
create policy "orders_admin_write" on orders
  for insert with check (is_admin());
create policy "orders_admin_update" on orders
  for update using (is_admin());

-- order_status_history: same visibility as the parent order
create policy "history_select_own_or_admin" on order_status_history
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );

-- proofs: same visibility as parent order; customers may update (approve/decline) their own
create policy "proofs_select_own_or_admin" on proofs
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );
create policy "proofs_customer_respond" on proofs
  for update using (
    exists (select 1 from orders o where o.id = order_id and o.customer_id = auth.uid())
  );
create policy "proofs_admin_write" on proofs
  for insert with check (is_admin());

-- allowed_emails: only admins (server-side, via service role) touch this table directly.
create policy "allowed_emails_admin_only" on allowed_emails
  for all using (is_admin());

-- ---------- Auto-create a profile when someone accepts their invite ----------
-- When Supabase creates the auth.users row (after the customer sets their password),
-- this copies their name from allowed_emails and creates their profile automatically.
create or replace function handle_new_user()
returns trigger as $$
declare
  matched_name text;
begin
  select full_name into matched_name from allowed_emails where email = new.email;

  insert into profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(matched_name, split_part(new.email, '@', 1)),
    case when new.email = 'sunrisewoodcreations@gmail.com' then 'admin' else 'customer' end
  );

  update allowed_emails set used = true where email = new.email;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();
