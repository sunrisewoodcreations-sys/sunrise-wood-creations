-- Production Schedule feature. All four fields are purely internal /
-- operational — none of them affect the existing customer-facing
-- order status, its email triggers, or any existing business logic.
-- production_status in particular is deliberately separate from the
-- existing `status` column (which drives customer emails and the
-- order timeline) so the two can never conflict.

alter table orders add column if not exists production_date date;

alter table orders add column if not exists priority text not null default 'normal'
  check (priority in ('high', 'normal', 'low'));

alter table orders add column if not exists production_status text not null default 'waiting'
  check (production_status in ('waiting', 'building', 'assembly', 'finishing', 'ready_for_pickup', 'completed'));

alter table orders add column if not exists production_notes text;
