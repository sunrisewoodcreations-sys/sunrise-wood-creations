-- Track whether you've responded to a quote request or guest chat, so
-- the sidebar can show how many are still waiting on you.
alter table quote_requests add column if not exists responded boolean not null default false;
alter table quote_requests add column if not exists converted_order_id uuid references orders(id);

alter table guest_messages add column if not exists responded boolean not null default false;

-- Tracks the last time YOU (admin) viewed a given order's chat thread —
-- used only to compute an internal unread count for your sidebar badge,
-- never shown to the customer.
alter table orders add column if not exists admin_last_read_at timestamptz;
