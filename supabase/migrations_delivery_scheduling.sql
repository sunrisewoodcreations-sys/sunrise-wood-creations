-- migrations_delivery_scheduling.sql
--
-- Delivery scheduling + blocked times + reminders + "on my way".
--
-- What this does (all additive; pickups keep working as before):
--   1. pickup_appointments gets a type (pickup | delivery), the exact
--      block of time the appointment uses, an "on my way" timestamp, a
--      1-hour reminder stamp, and an optional link to the delivery it
--      follows ("on my way home" stop).
--   2. A database-level guard: two active appointments can NEVER overlap.
--      Pickup = its 30 min. Delivery = drive there + time at customer +
--      drive home + buffer. Even if two customers click at the same
--      moment, the database refuses the second one.
--   3. schedule_blocked_times: days/hours you don't want any pickups or
--      deliveries (appointments, busy, days off).
--   4. orders.delivery_address / orders.delivery_drive_minutes: the
--      verified address and one-way drive time, looked up once per order.
--   5. delivery_settings: minutes spent at each customer + buffer after
--      getting home (both 15 by default).
--   6. Pickup settings corrected: one customer per slot, 10:00-19:00.
--
-- Run once in the Supabase SQL Editor. One transaction; if anything fails
-- nothing is changed. UNDO at the bottom.

begin;

-- 1. appointment columns ------------------------------------------------
alter table public.pickup_appointments
  add column if not exists appointment_type text not null default 'pickup'
    check (appointment_type in ('pickup', 'delivery')),
  add column if not exists block_start_at timestamp,   -- local (Eastern) wall-clock time
  add column if not exists block_end_at timestamp,
  add column if not exists on_my_way_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz,
  add column if not exists follows_appointment_id uuid references public.pickup_appointments(id) on delete set null;

-- Backfill any existing rows (pickups are a plain 30-minute block).
update public.pickup_appointments
set block_start_at = (appointment_date + appointment_time::time),
    block_end_at   = (appointment_date + appointment_time::time) + interval '30 minutes'
where block_start_at is null;

-- 2. no-overlap guard ----------------------------------------------------
-- Half-open ranges: a block ending at 12:30 does not conflict with one
-- starting at 12:30.
alter table public.pickup_appointments
  drop constraint if exists pickup_appointments_no_overlap;
alter table public.pickup_appointments
  add constraint pickup_appointments_no_overlap
  exclude using gist (tsrange(block_start_at, block_end_at) with &&)
  where (status in ('scheduled', 'arrived') and block_start_at is not null);

-- Safety net: any appointment saved without an explicit block (older code
-- paths) gets a plain 30-minute block, so it is still protected.
create or replace function public.pickup_appointments_fill_block()
returns trigger language plpgsql as $$
begin
  if new.block_start_at is null or new.block_end_at is null then
    new.block_start_at := (new.appointment_date + new.appointment_time::time);
    new.block_end_at   := new.block_start_at + interval '30 minutes';
  end if;
  return new;
end $$;
drop trigger if exists pickup_appointments_fill_block on public.pickup_appointments;
create trigger pickup_appointments_fill_block
  before insert on public.pickup_appointments
  for each row execute function public.pickup_appointments_fill_block();

-- 3. blocked times -------------------------------------------------------
create table if not exists public.schedule_blocked_times (
  id           uuid primary key default gen_random_uuid(),
  blocked_date date not null,
  start_time   time not null,
  end_time     time not null check (end_time > start_time),
  reason       text,
  created_at   timestamptz not null default now()
);
create index if not exists schedule_blocked_times_date_idx on public.schedule_blocked_times (blocked_date);

alter table public.schedule_blocked_times enable row level security;
drop policy if exists schedule_blocked_times_admin_only on public.schedule_blocked_times;
create policy schedule_blocked_times_admin_only on public.schedule_blocked_times
  for all using (is_admin()) with check (is_admin());

-- 4. order delivery address ---------------------------------------------
alter table public.orders
  add column if not exists delivery_address text,
  add column if not exists delivery_drive_minutes integer check (delivery_drive_minutes is null or delivery_drive_minutes >= 0);

-- 5. delivery timing settings -------------------------------------------
alter table public.delivery_settings
  add column if not exists minutes_at_customer integer not null default 15 check (minutes_at_customer >= 0),
  add column if not exists buffer_after_minutes integer not null default 15 check (buffer_after_minutes >= 0);

-- 6. pickup settings corrections ----------------------------------------
alter table public.pickup_availability_settings alter column max_pickups_per_slot set default 1;
update public.pickup_availability_settings
set max_pickups_per_slot = 1,
    start_time = '10:00',
    end_time = '19:00';

commit;

-- ---------------------------------------------------------------------
-- UNDO (only to back this out):
--   begin;
--   alter table public.pickup_appointments drop constraint if exists pickup_appointments_no_overlap;
--   alter table public.pickup_appointments
--     drop column if exists follows_appointment_id, drop column if exists reminder_1h_sent_at,
--     drop column if exists on_my_way_at, drop column if exists block_end_at,
--     drop column if exists block_start_at, drop column if exists appointment_type;
--   drop trigger if exists pickup_appointments_fill_block on public.pickup_appointments;
--   drop function if exists public.pickup_appointments_fill_block();
--   drop table if exists public.schedule_blocked_times;
--   alter table public.orders drop column if exists delivery_address, drop column if exists delivery_drive_minutes;
--   alter table public.delivery_settings drop column if exists minutes_at_customer, drop column if exists buffer_after_minutes;
--   commit;
-- ---------------------------------------------------------------------
