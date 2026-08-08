-- Shop Floor Mode. Reuses as much existing infrastructure as possible:
-- orders.production_notes for voice notes (already exists, already
-- shown on the order and Production Schedule card), product_bom_parts
-- for the material checklist (already exists, from the Cut List
-- Generator), and the same Supabase Storage pattern already used for
-- design proofs for photo uploads. Only genuinely new concepts —
-- timers, photos, per-product step checklists — get new tables.

-- One row per start/pause/finish cycle. A single order could have more
-- than one session if building gets paused and picked up again later
-- (e.g. across two days) — total actual time is the sum of all of an
-- order's sessions, not assumed to be exactly one.
create table if not exists order_build_sessions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  resumed_at timestamptz,
  finished_at timestamptz,
  -- Running total in seconds, updated on pause/resume/finish — stored
  -- directly rather than recomputed from timestamps every time, so a
  -- session that was paused and resumed multiple times still has one
  -- reliable total.
  elapsed_seconds integer not null default 0,
  status text not null default 'running' check (status in ('running', 'paused', 'finished')),
  created_at timestamptz not null default now()
);
alter table order_build_sessions enable row level security;
create policy "order_build_sessions_admin_all" on order_build_sessions for all using (is_admin());

create table if not exists order_progress_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  photo_url text not null,
  created_at timestamptz not null default now()
);
alter table order_progress_photos enable row level security;
create policy "order_progress_photos_admin_all" on order_progress_photos for all using (is_admin());

-- Per-product checklist template (e.g. "Sand corners", "Apply stain",
-- "Attach hardware") — defined once per product, reused for every
-- order of that product, same relationship shape as product_bom_parts.
create table if not exists product_checklist_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  step_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
alter table product_checklist_items enable row level security;
create policy "product_checklist_items_admin_all" on product_checklist_items for all using (is_admin());

-- Which of an order's checklist steps have been completed — separate
-- from the template above since the same product's checklist gets
-- reused across many orders, each with its own independent progress.
create table if not exists order_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  checklist_item_id uuid not null references product_checklist_items(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(order_id, checklist_item_id)
);
alter table order_checklist_progress enable row level security;
create policy "order_checklist_progress_admin_all" on order_checklist_progress for all using (is_admin());

-- Which of an order's required BOM parts (product_bom_parts) have
-- been marked as pulled/used during this build — same "one row per
-- checked item" shape as the checklist above, kept as its own table
-- since parts and build-steps are conceptually different checklists
-- even though both render as tap-to-check lists on Shop Floor Mode.
create table if not exists order_material_checklist_progress (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete cascade,
  bom_part_id uuid not null references product_bom_parts(id) on delete cascade,
  checked_at timestamptz not null default now(),
  unique(order_id, bom_part_id)
);
alter table order_material_checklist_progress enable row level security;
create policy "order_material_checklist_progress_admin_all" on order_material_checklist_progress for all using (is_admin());
