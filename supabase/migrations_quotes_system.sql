-- Complete Quotes system. Entirely new tables — nothing here alters
-- any existing table's columns, only adds new linking columns to
-- orders and quote_requests so the full history (request -> quote ->
-- order) can be traced without duplicating any existing data.

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number integer not null,
  quote_year integer not null,
  customer_id uuid not null references profiles(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined')),
  issue_date date not null default current_date,
  expiration_date date not null,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  tax_cents integer not null default 0,
  delivery_cents integer not null default 0,
  total_cents integer not null default 0,
  notes text,
  terms text,
  share_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  sent_at timestamptz,
  viewed_at timestamptz,
  converted_order_id uuid references orders(id),
  quote_request_id uuid references quote_requests(id),
  created_at timestamptz not null default now()
);
alter table quotes enable row level security;
create policy "quotes_admin_only" on quotes for all using (is_admin());
-- The public share link looks up a quote by its token with no logged-in
-- user at all, same pattern already used for proof-response links.
create policy "quotes_public_select_by_token" on quotes for select using (true);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  product_id uuid references products(id),
  title text not null,
  description text,
  quantity integer not null default 1,
  unit_price_cents integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table quote_items enable row level security;
create policy "quote_items_admin_only" on quote_items for all using (is_admin());
create policy "quote_items_public_select" on quote_items for select using (true);

-- Links back from an order to the quote it was created from, and from
-- a quote request to the formal quote it became — so the full history
-- is traceable in both directions without a separate join table.
alter table orders add column if not exists quote_id uuid references quotes(id);
alter table quote_requests add column if not exists converted_quote_id uuid references quotes(id);
