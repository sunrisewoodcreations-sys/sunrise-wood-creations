-- Inventory tracking: how many of each saved product you have on hand.
alter table products add column if not exists stock_quantity integer not null default 0;

-- Link orders to a saved product (when created via the picker) and track
-- how many were ordered, so stock can be checked/decremented correctly.
alter table orders add column if not exists product_id uuid references products(id);
alter table orders add column if not exists quantity integer not null default 1;
alter table orders add column if not exists stock_deducted boolean not null default false;
