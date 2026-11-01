-- migrations_order_number_per_year.sql
--
-- Order numbers now work like invoice numbers: they include the year and
-- restart every January.
--   real orders      ->  SWC-2026-1100, SWC-2026-1101, ...   (2027: SWC-2027-1100)
--   demo/test orders ->  DEMO-2026-1, DEMO-2026-2, ...
--
-- Existing orders are given their year (from the day they were placed,
-- Eastern time) and renumbered oldest-first within each year. Nothing else
-- in the app identifies an order by this number (the uuid stays the real
-- id), so renumbering only changes what is displayed.
--
-- One transaction: if anything fails nothing is changed.
begin;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='orders' and column_name='order_year') then
    raise exception 'orders.order_year already exists - already applied. Nothing was changed.';
  end if;
end $$;

-- 1. Year column + one counter per (year, real/demo).
alter table public.orders add column order_year integer;

create table public.order_number_counters (
  order_year integer not null,
  is_demo boolean not null,
  last_number integer not null,
  primary key (order_year, is_demo)
);
alter table public.order_number_counters enable row level security;  -- no policies: only the trigger below touches it

-- 2. Year + new number for existing orders.
alter table public.orders disable trigger orders_set_updated_at;
drop index if exists public.orders_order_number_key;

update public.orders
set order_year = extract(year from created_at at time zone 'America/New_York')::int;

with numbered as (
  select id,
         case when is_demo then row_number() over (partition by is_demo, order_year order by created_at, id)
              else 1099 + row_number() over (partition by is_demo, order_year order by created_at, id) end as num
  from public.orders
)
update public.orders o set order_number = n.num from numbered n where o.id = n.id;

alter table public.orders enable trigger orders_set_updated_at;

alter table public.orders alter column order_year set not null;
create unique index orders_order_number_key on public.orders (is_demo, order_year, order_number);

-- 3. Counters start at the highest number already used each year.
insert into public.order_number_counters (order_year, is_demo, last_number)
select order_year, is_demo, max(order_number) from public.orders group by order_year, is_demo;

-- 4. The database assigns year + number at insert time.
create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  y integer;
  n integer;
begin
  if tg_op = 'INSERT' or new.is_demo is distinct from old.is_demo then
    y := extract(year from now() at time zone 'America/New_York')::int;
    insert into public.order_number_counters as c (order_year, is_demo, last_number)
    values (y, new.is_demo, case when new.is_demo then 1 else 1100 end)
    on conflict (order_year, is_demo) do update set last_number = c.last_number + 1
    returning c.last_number into n;
    new.order_year := y;
    new.order_number := n;
  end if;
  return new;
end;
$$;
-- (trigger orders_assign_order_number already exists and keeps using this function)

drop sequence if exists public.order_number_seq;
drop sequence if exists public.demo_order_number_seq;

do $$
declare dup integer; missing integer;
begin
  select count(*) into missing from public.orders where order_number is null or order_year is null;
  if missing > 0 then raise exception 'Self-check failed: % order(s) missing number/year. Nothing was changed.', missing; end if;
  select count(*) into dup from (select 1 from public.orders group by is_demo, order_year, order_number having count(*) > 1) d;
  if dup > 0 then raise exception 'Self-check failed: duplicate order numbers. Nothing was changed.'; end if;
end $$;

commit;
