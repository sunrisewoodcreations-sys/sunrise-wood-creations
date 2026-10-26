-- migrations_schedule_reminders_cron.sql
--
-- Runs the appointment reminder emails (1 day before + 1 hour before, for
-- pickups and deliveries) every 10 minutes from inside Supabase. Vercel's
-- free plan only allows once-a-day cron jobs, which is too coarse for an
-- hour-before reminder.
--
-- BEFORE RUNNING: replace the two placeholders below.
--   YOUR_CRON_SECRET  -> the exact value of CRON_SECRET in Vercel
--   YOUR_SITE         -> https://www.sunrisewoodcreations.com
--
-- Run once in the Supabase SQL Editor (production project).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove an older copy if you run this twice.
select cron.unschedule('appointment-reminders')
where exists (select 1 from cron.job where jobname = 'appointment-reminders');

select cron.schedule(
  'appointment-reminders',
  '*/10 * * * *',
  $$
  select net.http_get(
    url := 'YOUR_SITE/api/cron/send-appointment-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
  );
  $$
);

-- Check it:   select * from cron.job;
-- Recent runs: select * from cron.job_run_details order by start_time desc limit 10;
-- Stop it:    select cron.unschedule('appointment-reminders');
