-- Fixes a real bug: deleting an order that came from an accepted quote
-- (or deleting a quote, or a quote request) was blocked entirely,
-- because none of these three links said what should happen on
-- deletion — Postgres defaults to refusing the delete outright.
--
-- The right behavior in every case is the same: the historical record
-- (the quote, or the quote request) should never be deleted or
-- corrupted just because something it's linked to gets deleted later.
-- It should just forget that specific link (set to NULL) and otherwise
-- remain exactly as it was.

alter table quotes drop constraint if exists quotes_converted_order_id_fkey;
alter table quotes add constraint quotes_converted_order_id_fkey
  foreign key (converted_order_id) references orders(id) on delete set null;

alter table orders drop constraint if exists orders_quote_id_fkey;
alter table orders add constraint orders_quote_id_fkey
  foreign key (quote_id) references quotes(id) on delete set null;

alter table quote_requests drop constraint if exists quote_requests_converted_quote_id_fkey;
alter table quote_requests add constraint quote_requests_converted_quote_id_fkey
  foreign key (converted_quote_id) references quotes(id) on delete set null;
