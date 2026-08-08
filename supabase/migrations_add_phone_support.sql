-- Lets a customer be created with just a phone number, no email —
-- for texting updates and (once you enable phone login in Supabase's
-- dashboard) logging into their account with just their phone.
alter table profiles add column if not exists phone text;
create unique index if not exists profiles_phone_unique on profiles(phone) where phone is not null;
