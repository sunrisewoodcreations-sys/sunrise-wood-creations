-- Tracks when the customer has actually opened/read a message the shop
-- sent. Deliberately one-directional — only the shop sees read status;
-- customers never see whether the shop has read their messages.
alter table order_messages add column if not exists read_at timestamptz;

-- Needed so a customer's session can mark a shop message as read (there
-- was previously no update permission on this table at all).
create policy "order_messages_update_own_or_admin" on order_messages
  for update using (
    exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin()))
  );
