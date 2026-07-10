-- Admin-only tool: AI-generated cornhole board design concepts.
create table if not exists design_generations (
  id uuid primary key default gen_random_uuid(),
  prompt text not null,
  reference_image_url text,
  result_image_url text,
  created_at timestamptz not null default now()
);

alter table design_generations enable row level security;

create policy "design_generations_admin_only" on design_generations
  for all using (is_admin());
