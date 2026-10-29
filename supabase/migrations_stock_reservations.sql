-- Stock is set aside (reserved) for an order the moment it is placed, even if
-- only part of the order can be covered (e.g. order of 3, 2 on hand -> the 2
-- come off the shelf now and 1 is left to build). These columns remember how
-- many pieces of each order line have already been set aside.
-- Additive and safe to run more than once.
alter table order_items add column if not exists stock_reserved_qty integer not null default 0;
alter table orders add column if not exists stock_reserved_qty integer not null default 0;
