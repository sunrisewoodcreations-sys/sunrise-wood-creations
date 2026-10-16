-- migrations_add_delivery_calculator.sql
--
-- Supports the quote editor's "Calculate delivery" button:
--   1. delivery_settings: one row holding your home address, the price per
--      mile, and an optional minimum fee. Admin only (is_admin()).
--   2. quotes.delivery_address / quotes.delivery_miles: remembers the
--      verified address and miles a quote's delivery fee was figured from.
--
-- Purely additive: two new nullable columns and one new table. No quote
-- total, price, coupon, order or email is changed. Existing quotes simply
-- have an empty delivery address.
--
-- Run once in the Supabase SQL Editor. One transaction; if anything fails
-- nothing is changed. UNDO at the bottom.

begin;

do $$
begin
  if to_regclass('public.delivery_settings') is not null then
    raise exception 'public.delivery_settings already exists - this migration was already applied. Nothing was changed.';
  end if;
end $$;

create table public.delivery_settings (
  id                int primary key default 1 check (id = 1),   -- always exactly one row
  home_address      text,
  per_mile_cents    integer not null default 0 check (per_mile_cents >= 0),
  minimum_fee_cents integer not null default 0 check (minimum_fee_cents >= 0),
  updated_at        timestamptz not null default now()
);

insert into public.delivery_settings (id) values (1);

alter table public.delivery_settings enable row level security;
create policy delivery_settings_admin_only on public.delivery_settings
  for all using (is_admin()) with check (is_admin());

create trigger delivery_settings_set_updated_at
  before update on public.delivery_settings
  for each row execute function set_updated_at();

alter table public.quotes add column delivery_address text;
alter table public.quotes add column delivery_miles numeric(7,1);

commit;

-- ---------------------------------------------------------------------
-- UNDO (only to back this out):
--   begin;
--   alter table public.quotes drop column if exists delivery_address;
--   alter table public.quotes drop column if exists delivery_miles;
--   drop table if exists public.delivery_settings;
--   commit;
-- ---------------------------------------------------------------------
