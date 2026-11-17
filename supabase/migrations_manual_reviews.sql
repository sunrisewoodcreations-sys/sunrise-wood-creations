-- migrations_manual_reviews.sql
-- Lets the admin add reviews by hand (e.g. copied from Facebook). Those
-- reviews aren't tied to an order or a customer account, so the two ids
-- become optional, and a few text fields carry the reviewer's name and the
-- product. Customer reviews written on the site are unchanged.
-- Safe to run again.

alter table public.product_reviews alter column order_item_id drop not null;
alter table public.product_reviews alter column customer_id drop not null;
alter table public.product_reviews add column if not exists reviewer_name text;
alter table public.product_reviews add column if not exists product_label text;
alter table public.product_reviews add column if not exists source text not null default 'site';
alter table public.product_reviews drop constraint if exists product_reviews_source_check;
alter table public.product_reviews add constraint product_reviews_source_check check (source in ('site', 'facebook'));
