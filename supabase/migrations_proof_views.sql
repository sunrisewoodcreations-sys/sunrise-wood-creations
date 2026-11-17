-- migrations_proof_views.sql
-- Tracks whether the customer has opened a design proof: when they first
-- opened it, the most recent time, and how many times. Safe to run again.

alter table public.proofs add column if not exists first_viewed_at timestamptz;
alter table public.proofs add column if not exists last_viewed_at timestamptz;
alter table public.proofs add column if not exists view_count integer not null default 0;
