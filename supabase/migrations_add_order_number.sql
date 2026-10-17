-- migrations_add_order_number.sql
--
-- Adds a customer-facing, sequential order number:
--   real orders      ->  SWC-1001, SWC-1002, ...
--   demo/test orders ->  DEMO-1, DEMO-2, ...   (separate counter, so a test
--                                              order can never use up a real
--                                              customer's number)
--
-- Purely additive. The internal order id (uuid) stays the one real
-- identifier for every link, lookup, invoice, payment, proof, pickup
-- appointment, coupon and quote. Nothing reads order_number except the
-- order-status emails and the admin order search.
--
-- Run this whole script once, in the Supabase SQL Editor. It is one
-- transaction: if anything fails, nothing is changed. If you ever see an
-- error, run   rollback;   once and send the error message to Claude.
--
-- Safe to run when nobody is creating orders (it takes a brief lock on
-- the orders table, well under a second with this much data).

begin;

-- 0. Refuse to run twice.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'order_number'
  ) then
    raise exception 'orders.order_number already exists - this migration was already applied. Nothing was changed.';
  end if;
end $$;

-- 1. Two independent counters.
create sequence public.order_number_seq      start with 1001 minvalue 1001;  -- real orders
create sequence public.demo_order_number_seq start with 1    minvalue 1;     -- demo/test orders

-- 2. The new column (nullable until the existing orders are numbered).
alter table public.orders add column order_number integer;

-- 3. Number the existing orders, oldest first.
--    The orders_set_updated_at trigger is switched off for just this step
--    so numbering doesn't change any order's "updated at" time. It is
--    switched back on right after, inside this same transaction.
--    (The status-history triggers only act when an order's status changes,
--    which this step never does, so no history rows are added.)
alter table public.orders disable trigger orders_set_updated_at;

with real_numbered as (
  select id, 1000 + row_number() over (order by created_at, id) as num
  from public.orders where is_demo = false
),
demo_numbered as (
  select id, row_number() over (order by created_at, id) as num
  from public.orders where is_demo = true
),
all_numbered as (
  select id, num from real_numbered
  union all
  select id, num from demo_numbered
)
update public.orders o
set order_number = a.num
from all_numbered a
where o.id = a.id;

alter table public.orders enable trigger orders_set_updated_at;

-- 4. Point each counter at the next unused number.
select setval('public.order_number_seq',
              coalesce((select max(order_number) from public.orders where is_demo = false), 1000) + 1,
              false);
select setval('public.demo_order_number_seq',
              coalesce((select max(order_number) from public.orders where is_demo = true), 0) + 1,
              false);

-- 5. Every order now has a number: make that a rule, and make it unique
--    within real orders and within demo orders.
alter table public.orders alter column order_number set not null;
create unique index orders_order_number_key on public.orders (is_demo, order_number);

-- 6. From now on the database assigns the number itself, at the moment an
--    order is inserted, from whichever counter matches the order's is_demo
--    flag. Two orders created at the same instant can never get the same
--    number, and no application code has to remember to do it. The
--    function runs with its owner's rights so it works no matter which
--    role inserts the order. If an order is ever flipped between demo and
--    real, it is given a fresh number from the matching counter.
create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.is_demo is distinct from old.is_demo then
    if new.is_demo then
      new.order_number := nextval('public.demo_order_number_seq');
    else
      new.order_number := nextval('public.order_number_seq');
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_assign_order_number
  before insert or update of is_demo on public.orders
  for each row
  execute function public.assign_order_number();

-- 7. Final self-check before committing. Any failure here cancels
--    everything above.
do $$
declare
  missing integer;
  duplicated integer;
begin
  select count(*) into missing from public.orders where order_number is null;
  if missing > 0 then
    raise exception 'Self-check failed: % order(s) have no order_number. Nothing was changed.', missing;
  end if;

  select count(*) into duplicated from (
    select is_demo, order_number from public.orders group by is_demo, order_number having count(*) > 1
  ) d;
  if duplicated > 0 then
    raise exception 'Self-check failed: duplicate order numbers found. Nothing was changed.';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------
-- UNDO (only if you ever need to back this out; run as its own script).
-- The website code is written to cope with the column being absent: the
-- emails simply leave the order-number line out.
--
-- begin;
-- drop trigger  if exists orders_assign_order_number on public.orders;
-- drop function if exists public.assign_order_number();
-- drop index    if exists public.orders_order_number_key;
-- alter table public.orders drop column if exists order_number;
-- drop sequence if exists public.order_number_seq;
-- drop sequence if exists public.demo_order_number_seq;
-- commit;
-- ---------------------------------------------------------------------
