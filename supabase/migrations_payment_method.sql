-- migrations_payment_method.sql
-- Records how an order was paid (cash / card / check / Venmo / Zelle) and,
-- for Venmo and Zelle, the transaction number (optional reference for card
-- and check). Shown on the invoice. Run in the Supabase SQL Editor. Safe to
-- run again, including if an earlier version of this file was already run.

alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_reference text;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('cash', 'card', 'check', 'venmo', 'zelle'));
