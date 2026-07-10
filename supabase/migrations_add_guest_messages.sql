-- Messages sent by anonymous website visitors through the guest chat
-- bubble (people who haven't logged in / purchased yet). Anyone can
-- insert one (that's the whole point — it's a public contact form
-- styled as a chat), but only admins can read them back.
create table if not exists guest_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table guest_messages enable row level security;

create policy "guest_messages_public_insert" on guest_messages
  for insert with check (true);

create policy "guest_messages_admin_select" on guest_messages
  for select using (is_admin());
