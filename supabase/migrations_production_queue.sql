-- Production Queue: smart, multi-factor auto-sorting with manual
-- drag-and-drop override. Purely additive — nothing here changes any
-- existing order or customer until explicitly set.

-- Simple, admin-set flag — no separate "priority customers" table
-- needed for something this small.
alter table profiles add column if not exists is_priority_customer boolean not null default false;

-- Null means "let the automatic multi-factor sort decide." A real
-- integer means "this order was manually dragged to a specific spot,
-- honor that instead of the automatic ranking."
alter table orders add column if not exists manual_queue_position integer;
