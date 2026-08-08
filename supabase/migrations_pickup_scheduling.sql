-- Complete Pickup Scheduling system. Entirely new tables — nothing
-- here alters orders.status or its existing progression, specifically
-- to avoid disrupting the customer progress bar, existing status-
-- triggered emails, or invoice generation, all of which key off the
-- existing status values. "Pickup Scheduled" is derived from whether a
-- real appointment row exists for an order, not a new stored status.

create table if not exists pickup_appointments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  appointment_date date not null,
  appointment_time text not null, -- e.g. "14:00", stored as text for simple slot matching
  status text not null default 'scheduled'
    check (status in ('scheduled', 'arrived', 'completed', 'missed', 'cancelled')),
  source text not null check (source in ('customer_token_link', 'customer_account', 'admin_manual')),
  -- Set only when this appointment has been moved from its original
  -- booking, and by whom — drives the "Customer Rescheduled" badge
  -- specifically (distinct from a first-time "Pickup Scheduled").
  rescheduled_by text check (rescheduled_by in ('customer', 'admin')),
  -- Unlike the order-level scheduling token, this one is safe to store
  -- here directly: by the time a customer needs a reschedule link, the
  -- appointment already exists (it's in their confirmation email).
  reschedule_token text unique default encode(gen_random_bytes(24), 'hex'),
  -- Timestamps set once each reminder actually goes out — prevents
  -- double-sending if the reminder check runs more than once near the
  -- same window, and lets the Production Overview show whether a
  -- reminder has already gone out for a given appointment.
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  -- Admin-only — never shown to the customer anywhere (scheduling
  -- page, confirmation email, or reminder email).
  internal_notes text,
  -- Reserved for future use: requiring payment before a customer can
  -- schedule. Always null today; nothing reads or enforces this yet.
  payment_required_cents integer,
  payment_received_at timestamptz,
  created_at timestamptz not null default now()
);
alter table pickup_appointments enable row level security;
create policy "pickup_appointments_admin_all" on pickup_appointments for all using (is_admin());
-- The public scheduling page creates the appointment row after
-- validating the order's own token (see orders.pickup_scheduling_token
-- below) — this policy just allows that insert/select with no logged-in
-- user, same principle as the proof-response and quote-acceptance
-- token routes.
create policy "pickup_appointments_public_select" on pickup_appointments for select using (true);
create policy "pickup_appointments_public_insert" on pickup_appointments for insert with check (true);

-- The scheduling link's token lives on the order itself, since it has
-- to exist and be valid BEFORE any appointment row is created — it's
-- what gets the customer to the scheduling page in the first place.
-- token_used_at disables the link once they've booked, so it can't be
-- reused to double-book or rebook without admin help. sent_at exists
-- separately so "email sent, not booked yet" can be told apart from
-- "not sent yet" for the Production Overview badges.
alter table orders add column if not exists pickup_scheduling_token text unique;
alter table orders add column if not exists pickup_scheduling_token_used_at timestamptz;
alter table orders add column if not exists pickup_scheduling_email_sent_at timestamptz;

-- One-row settings table, matching the same simple pattern already
-- used for report_settings and site_settings elsewhere in this app.
create table if not exists pickup_availability_settings (
  id uuid primary key default gen_random_uuid(),
  business_address text not null default 'Lawrence, Michigan 49064',
  contact_phone text not null default '(269) 762-1460',
  pickup_instructions text not null default 'Please pull into the driveway and ring the shop doorbell.',
  available_days integer[] not null default '{1,2,3,4,5}', -- 0=Sunday .. 6=Saturday
  start_time text not null default '09:00',
  end_time text not null default '17:00',
  slot_length_minutes integer not null default 30,
  max_pickups_per_slot integer not null default 2,
  -- While enabled, no dates are offered to customers at all, regardless
  -- of available_days/blocked_dates — a simple, single switch for
  -- "we're closed" rather than having to block every date individually.
  -- 24-hour reminders always send; the 2-hour one is optional since
  -- not every shop wants a same-day second email.
  send_2hour_reminder boolean not null default false,
  vacation_mode_enabled boolean not null default false,
  vacation_return_date date,
  updated_at timestamptz not null default now()
);
alter table pickup_availability_settings enable row level security;
create policy "pickup_availability_admin_all" on pickup_availability_settings for all using (is_admin());
create policy "pickup_availability_public_select" on pickup_availability_settings for select using (true);

create table if not exists pickup_blocked_dates (
  id uuid primary key default gen_random_uuid(),
  blocked_date date not null unique,
  reason text,
  created_at timestamptz not null default now()
);
alter table pickup_blocked_dates enable row level security;
create policy "pickup_blocked_dates_admin_all" on pickup_blocked_dates for all using (is_admin());
create policy "pickup_blocked_dates_public_select" on pickup_blocked_dates for select using (true);

-- Products have no photo field anywhere in this app today (confirmed
-- by direct investigation). Added here since the customer order
-- preview on the scheduling page and confirmation email need it —
-- genuinely optional (nullable), so this changes nothing about
-- existing product display anywhere it's not explicitly used.
alter table products add column if not exists image_url text;

-- No delivery/shipping concept exists anywhere in this app today
-- (confirmed by direct investigation) — everything has always assumed
-- pickup. This is intentionally minimal: it only gates whether the
-- pickup scheduling system applies to a given order. It does not
-- change invoice wording, status labels, or anything else; every
-- existing and future order defaults to 'pickup', so nothing about
-- current behavior changes unless an order is explicitly marked
-- otherwise.
alter table orders add column if not exists fulfillment_method text not null default 'pickup'
  check (fulfillment_method in ('pickup', 'delivery', 'shipping'));
