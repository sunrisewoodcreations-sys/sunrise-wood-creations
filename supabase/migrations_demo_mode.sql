-- Demo/Testing Mode. Two distinct flags, deliberately not merged into
-- one, because they mean different things:
--   is_demo_account  — flags the ONE special login used by the tester
--                       (a real, valid admin account, not a bypass)
--   is_demo          — flags individual DATA records (orders,
--                       customers, quotes) created while using that
--                       account, so they can be shown/reset in
--                       isolation from real business data
alter table profiles add column if not exists is_demo_account boolean not null default false;
alter table profiles add column if not exists is_demo boolean not null default false;
alter table orders add column if not exists is_demo boolean not null default false;
alter table quotes add column if not exists is_demo boolean not null default false;

-- Matches exactly the columns sendViaResend() in email.ts actually
-- inserts — every attempted email gets logged here when sent by the
-- demo account, whether it succeeded or not, and whether it was
-- actually deliverable (a DEMO_TEST_EMAIL is configured) or simply
-- captured with nowhere to go.
create table if not exists demo_email_log (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  intended_recipient text not null,
  redirected_to text not null,
  subject text,
  success boolean not null,
  error_message text,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table demo_email_log enable row level security;
create policy "demo_email_log_admin_all" on demo_email_log for all using (is_admin());
