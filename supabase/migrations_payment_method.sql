-- migrations_payment_method.sql
-- Records how an order was paid (cash / Venmo / Zelle) and, for Venmo and
-- Zelle, the transaction number. Shown on the invoice. Run once in the
-- Supabase SQL Editor. Safe to run twice.

alter table public.orders
  add column if not exists payment_method text check (payment_method is null or payment_method in ('cash', 'venmo', 'zelle')),
  add column if not exists payment_reference text;
