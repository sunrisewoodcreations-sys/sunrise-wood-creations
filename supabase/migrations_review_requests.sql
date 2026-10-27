-- migrations_review_requests.sql
-- Lets the site email customers a day after pickup/delivery asking them to
-- rate their order, exactly once per order. Run once in the Supabase SQL Editor.

alter table public.orders add column if not exists review_request_sent_at timestamptz;

-- Don't email anyone about orders that were completed before this existed.
update public.orders set review_request_sent_at = now()
where status = 'picked_up' and review_request_sent_at is null;
