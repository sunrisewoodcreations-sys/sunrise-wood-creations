-- migrations_add_leads.sql
--
-- Adds the "Leads" list: people who messaged you (Facebook, Instagram,
-- text, ...) that you want to keep track of until they order.
--
-- Purely additive: one new table. No existing table, order, customer,
-- invoice, coupon or email is touched. Admin-only (same is_admin() rule
-- used by Quotes and Customer Notes); customers can never see it.
--
-- Run once in the Supabase SQL Editor. One transaction: if anything fails
-- nothing is changed. UNDO at the bottom.

begin;

do $$
begin
  if to_regclass('public.leads') is not null then
    raise exception 'public.leads already exists - this migration was already applied. Nothing was changed.';
  end if;
end $$;

create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (length(btrim(full_name)) > 0),
  phone            text,
  source           text not null default 'facebook'
                   check (source in ('facebook','instagram','text','phone','in_person','other')),
  status           text not null default 'in_talks'
                   check (status in ('in_talks','not_responding','ordered','not_interested')),
  notes            text,
  -- Set when you click "Create order": the customer this lead became.
  -- If that customer is ever deleted the lead stays, just unlinked.
  customer_id      uuid references public.profiles(id) on delete set null,
  -- Demo-account leads are kept separate from real ones, like orders.
  is_demo          boolean not null default false,
  first_contacted_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index leads_is_demo_status_idx on public.leads (is_demo, status);
create index leads_customer_idx on public.leads (customer_id);

alter table public.leads enable row level security;
create policy leads_admin_only on public.leads
  for all using (is_admin()) with check (is_admin());

create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function set_updated_at();

commit;

-- ---------------------------------------------------------------------
-- UNDO (only to back this out; deletes the leads list and what's in it):
--   drop table if exists public.leads;
-- ---------------------------------------------------------------------
