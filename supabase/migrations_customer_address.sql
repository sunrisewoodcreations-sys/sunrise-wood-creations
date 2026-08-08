-- Optional mailing address for a customer profile. Nullable — nothing
-- requires it, existing customer records are unaffected.
alter table profiles add column if not exists address text;
