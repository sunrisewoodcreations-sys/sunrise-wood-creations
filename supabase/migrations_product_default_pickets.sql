-- Lets a saved planter product specify how many pickets it uses by
-- default, so creating an order with it automatically logs and costs
-- the picket usage — no manual entry needed per order.
alter table products add column if not exists pickets_per_unit integer not null default 0;
