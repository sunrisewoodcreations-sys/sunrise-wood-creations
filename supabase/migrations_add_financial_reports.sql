-- Settings controlling the automated financial summary email: how often
-- it sends, what percentage of profit to suggest setting aside for
-- income tax (your own estimate, not a real tax calculation), and who
-- receives it. Singleton row (id = 1), same pattern as site_settings.
create table if not exists report_settings (
  id integer primary key default 1,
  frequency text not null default 'off' check (frequency in ('off', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  estimated_tax_set_aside_percent numeric not null default 25,
  recipient_email text not null default 'sunrisewoodcreations@gmail.com',
  last_sent_period_end date,
  constraint single_row check (id = 1)
);

insert into report_settings (id) values (1)
  on conflict (id) do nothing;

alter table report_settings enable row level security;
create policy "report_settings_admin_only" on report_settings
  for all using (is_admin());
