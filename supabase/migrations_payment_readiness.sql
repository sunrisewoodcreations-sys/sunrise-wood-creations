-- Payment-readiness structure. No payment processor exists in this
-- codebase today (confirmed by direct investigation), so nothing here
-- changes any current behavior — every new column defaults to values
-- that mean "not using this yet." This just gives Stripe (or any
-- processor) a clean place to plug in later without a schema change
-- at that point.

alter table quotes add column if not exists deposit_required_cents integer;

alter table orders add column if not exists payment_status text not null default 'not_required'
  check (payment_status in ('not_required', 'deposit_pending', 'deposit_paid', 'paid_in_full'));
alter table orders add column if not exists stripe_payment_intent_id text;
