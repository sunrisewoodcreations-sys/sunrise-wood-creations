-- Tracks whether a customer actually has a real email on file (vs. a
-- private placeholder used internally so "no email" customers can still
-- have a database record without ever getting an account or any email).
alter table profiles add column if not exists has_real_email boolean not null default true;

-- Per-category email notification preferences, set when the customer is
-- created. All default to on; unchecking any of these silences that
-- category going forward, even for manual "send" buttons.
alter table profiles add column if not exists notify_order_updates boolean not null default true;
alter table profiles add column if not exists notify_invoices boolean not null default true;
alter table profiles add column if not exists notify_proofs boolean not null default true;
alter table profiles add column if not exists notify_messages boolean not null default true;
