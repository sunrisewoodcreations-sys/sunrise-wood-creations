-- Cut List Generator integration — brings the tested prototype into
-- the real site, using real products instead of sample data.

-- Bill of Materials, one row per part, linked to a real product.
create table if not exists product_bom_parts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  part_name text not null,
  length_inches numeric not null,
  final_length_inches numeric,       -- trim only: length after final-fit trim post-assembly
  quantity_per_unit integer not null default 1,
  material_type text not null default 'Cedar',
  is_trim boolean not null default false,
  grain_direction text check (grain_direction in ('length', 'width', 'either')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table product_bom_parts enable row level security;
create policy "product_bom_parts_admin_only" on product_bom_parts
  for all using (is_admin());

-- Saved cut lists, stored in the database (not browser-only) now that
-- this is part of the real site — the whole computed result is stored
-- as JSON, same shape the app already generates.
create table if not exists saved_cut_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  board_length numeric not null,
  kerf numeric not null,
  result_json jsonb not null,
  created_at timestamptz not null default now()
);
alter table saved_cut_lists enable row level security;
create policy "saved_cut_lists_admin_only" on saved_cut_lists
  for all using (is_admin());
