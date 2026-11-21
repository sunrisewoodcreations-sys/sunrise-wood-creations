-- Each design on a two-image proof can be approved or sent back on its own.
-- proofs.status stays the overall result (pending until every design is answered).
alter table public.proofs add column if not exists design1_decision text;
alter table public.proofs add column if not exists design1_feedback text;
alter table public.proofs add column if not exists design2_decision text;
alter table public.proofs add column if not exists design2_feedback text;
