-- migrations_proof_views.sql
-- (also adds an optional note to the customer that goes with a proof)
-- Tracks whether the customer has opened a design proof: when they first
-- opened it, the most recent time, and how many times. Safe to run again.

alter table public.proofs add column if not exists first_viewed_at timestamptz;
alter table public.proofs add column if not exists last_viewed_at timestamptz;
alter table public.proofs add column if not exists view_count integer not null default 0;
alter table public.proofs add column if not exists message text;
