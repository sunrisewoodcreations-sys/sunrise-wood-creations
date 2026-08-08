# Migration Checklist

Every schema change made to this project lives in its own `.sql` file
in this folder, in the order they were written. There's no automatic
tracking of which ones you've already run in Supabase — this file is
that tracking, kept by hand.

**How to use this:** go through in order, check the box once you've
run it in the Supabase SQL Editor. If a feature already works for you
(the description says so), you can safely check it off without
re-running it — every migration uses `if not exists` / `if not exists`
guards, so re-running an already-applied one is harmless, just
unnecessary.

If you get to one where you're not sure, run it — it won't break
anything already in place.

## Foundational (early build)

- [ ] `migrations_add_inventory.sql` — product stock tracking
- [ ] `migrations_add_designs.sql` — saved design/logo generation
- [ ] `migrations_add_order_items.sql` — multi-item orders (an order can contain more than one product)
- [ ] `migrations_add_messages.sql` — order messaging thread
- [ ] `migrations_add_message_read.sql` — read/unread tracking on messages
- [ ] `migrations_add_guest_messages.sql` — messages from the public contact page
- [ ] `migrations_admin_features_batch.sql` — assorted early admin fields
- [ ] `migrations_add_financial_reports.sql` — daily financial report emails
- [ ] `migrations_add_picket_inventory.sql` — cedar picket pallet tracking
- [ ] `migrations_add_phone_support.sql` — phone number field on customers
- [ ] `migrations_email_prefs.sql` — customer notification preferences
- [ ] `migrations_quotes_messages_badges.sql` — sidebar unread-count badges

## Pricing, tax, and picket costing

- [ ] `migrations_split_tax_rates.sql` — Michigan sales tax handling
- [ ] `migrations_picket_allocations.sql` — FIFO picket cost allocation
- [ ] `migrations_pickets_per_item.sql` — moves picket usage to the line-item level (supports multi-planter orders)
- [ ] `migrations_product_default_pickets.sql` — `pickets_per_unit` on saved products, for automatic costing

## Customer & inventory refinements

- [ ] `migrations_customer_address.sql` — customer address field
- [ ] `migrations_stock_adjustments.sql` — manual stock adjustment log

## Production Schedule & Cut List Generator

- [ ] `migrations_production_schedule.sql` — production_date, priority, production_status on orders — **required** before Production Schedule or the Manufacturing Queue will work
- [ ] `migrations_cutlist_integration.sql` — BOM parts per product, saved cut lists

## Invoicing & build time

- [ ] `migrations_invoice_year_numbering.sql` — invoice numbers reset each year
- [ ] `migrations_estimated_build_time.sql` — per-product estimated build minutes

## Quotes system

- [ ] `migrations_quotes_system.sql` — the full Quotes system (quotes, quote_items, links to orders/quote_requests)
- [ ] `migrations_quote_revisions.sql` — quote revision history and versioning
- [ ] `migrations_payment_readiness.sql` — deposit-tracking columns, unused today, ready for future Stripe integration
- [ ] `migrations_fix_quote_order_delete.sql` — **fixes a real bug**: deleting an order tied to a quote used to fail

## Pickup Scheduling, Production Queue, Capacity, Shop Floor

- [ ] `migrations_pickup_scheduling.sql` — the full Pickup Scheduling system
- [ ] `migrations_production_queue.sql` — customer priority flag, manual queue reordering
- [ ] `migrations_production_capacity.sql` — daily production capacity settings
- [ ] `migrations_shop_floor.sql` — build timers, progress photos, per-product checklists

---

**Recommendation going forward:** once you've confirmed everything
above is applied, treat this file as the source of truth for future
migrations too — I'll keep adding new ones to the bottom of the list
here rather than let them scatter with no tracking again.
