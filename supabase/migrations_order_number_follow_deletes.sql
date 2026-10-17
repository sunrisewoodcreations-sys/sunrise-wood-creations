-- migrations_order_number_follow_deletes.sql
--
-- Run AFTER migrations_add_order_number.sql (already applied).
--
-- Changes how a NEW order gets its customer-facing number, so the numbering
-- follows deletes automatically and no reset script is ever needed:
--
--   next real order number = (highest real order number that exists) + 1
--   next demo order number = (highest demo order number that exists) + 1
--
--   * No real orders left            -> the next real order is SWC-1001.
--   * Delete the newest order(s)     -> the next order reuses that number.
--   * Delete an order in the middle  -> the others keep their numbers; the
--                                       gap stays (existing orders are never
--                                       renumbered).
--
-- TRADE-OFF (please read): because numbers are reused after a delete, if you
-- ever delete a REAL customer's newest order, the next customer gets that
-- same number, and an old email that said "SWC-1005" would then refer to a
-- different order. Fine for test orders; for real customers prefer leaving
-- an order in place (for example cancelled) rather than deleting it.
--
-- Two orders created at the same instant are handled by a short lock, and
-- the unique index from the first migration is a second safety net.
--
-- Only the numbering function is replaced. Nothing else changes: no order is
-- touched, and existing numbers stay exactly as they are.
-- One transaction; if anything fails nothing changes.

begin;

create or replace function public.assign_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.is_demo is distinct from old.is_demo then
    -- Make simultaneous inserts take turns, so they can't both pick the same number.
    perform pg_advisory_xact_lock(hashtext('orders.order_number'));
    if new.is_demo then
      new.order_number := coalesce((select max(order_number) from public.orders where is_demo = true), 0) + 1;
    else
      new.order_number := coalesce((select max(order_number) from public.orders where is_demo = false), 1000) + 1;
    end if;
  end if;
  return new;
end;
$$;

commit;

-- UNDO (back to the counter-based numbering): re-run the function from step 6
-- of migrations_add_order_number.sql.
