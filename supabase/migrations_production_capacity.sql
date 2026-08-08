-- Production Capacity Planning. Reuses pickup_blocked_dates for "days
-- production is unavailable" rather than a second blocked-dates table
-- — if the shop is closed for a holiday, neither pickup nor production
-- happens that day, so one table correctly serves both. Reuses
-- products.estimated_build_minutes directly (already exists, already
-- editable from the Products page) rather than a second per-product
-- time estimate.

create table if not exists production_capacity_settings (
  id uuid primary key default gen_random_uuid(),
  max_hours_per_day numeric not null default 8,
  buffer_minutes_per_day integer not null default 60,
  updated_at timestamptz not null default now()
);
alter table production_capacity_settings enable row level security;
create policy "production_capacity_admin_all" on production_capacity_settings for all using (is_admin());
