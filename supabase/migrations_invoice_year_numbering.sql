-- Adds a year component to invoice numbers (e.g. "2026-1100"), resetting
-- to 1100 at the start of each calendar year. invoice_number itself
-- stays a plain integer that resets per-year; invoice_year records
-- which year that number belongs to, so the two together form the
-- full displayed invoice number.
alter table invoices add column if not exists invoice_year integer;

-- Backfill existing invoices with the year they were actually created
-- in, so historical invoices display correctly without being renumbered.
update invoices set invoice_year = extract(year from created_at)::integer
where invoice_year is null;

alter table invoices alter column invoice_year set not null;
