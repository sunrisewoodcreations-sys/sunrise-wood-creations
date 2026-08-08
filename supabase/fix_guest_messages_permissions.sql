-- guest_messages only ever had INSERT (public contact form) and SELECT
-- (admin reading) policies. Admin-only UPDATE (marking as responded)
-- and DELETE (removing old test conversations) were never granted,
-- so those actions have been silently failing — the app was requesting
-- them correctly the whole time, the database just never allowed them.
create policy "guest_messages_admin_update" on guest_messages
  for update using (is_admin());

create policy "guest_messages_admin_delete" on guest_messages
  for delete using (is_admin());

-- quote_requests has the exact same gap — its own "Mark as responded"
-- toggle has been silently failing for the same reason (the "Convert
-- to order" action was unaffected, since that route already uses the
-- admin/service-role client, which bypasses RLS entirely). Fixing it
-- here too rather than waiting for it to get reported separately.
create policy "quote_requests_admin_update" on quote_requests
  for update using (is_admin());
