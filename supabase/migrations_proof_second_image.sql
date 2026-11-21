-- A proof can carry a second design image (e.g. two different board designs).
-- One approval covers both. Safe to run again.
alter table public.proofs add column if not exists image_url_2 text;
