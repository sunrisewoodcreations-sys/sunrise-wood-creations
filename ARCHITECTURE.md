# Sunrise Wood Creations — Architecture Overview

Last reviewed as part of a full engineering audit. This document describes
how the major systems work and interact, and where new features should
plug in, so future work builds on what exists instead of duplicating it.

## Stack

Next.js 14 (App Router), Supabase (Postgres + Auth + Storage), Resend
(email), pdf-lib (PDF generation), Tailwind CSS. Deployed on Vercel,
including a real Vercel Cron job for the daily financial report.

## Core data model

**profiles** — every user, customer and admin alike, distinguished by
`role`. Customers have `is_priority_customer` for queue prioritization.

**orders** — the central record. Has accumulated many concerns over
time (fulfillment method, quote linkage, production tracking, pickup
scheduling, manual queue position). This is the one table worth
watching as the app grows — if it keeps absorbing new concerns, some
(especially pickup-related fields) may eventually deserve their own
table rather than more columns here.

**Two separate status systems, on purpose:**
- `orders.status` — customer-facing (order_placed → ... → picked_up).
  Drives customer emails, invoicing, and the progress bar customers see.
- `orders.production_status` — internal only (waiting → building →
  assembly → finishing → ready_for_pickup → completed). Drives the
  Manufacturing Queue and Shop Floor Mode.

These are deliberately kept independent so internal production
tracking never disrupts customer-facing status or its side effects
(emails, invoicing). Any new "stage" concept should follow this same
pattern — compute a derived display state from existing fields rather
than adding a third stored status column. This is exactly how the
Pickup Scheduling badges and workflow stages already work.

**quotes / quote_items** — the formal quoting system, separate from
**quote_requests** (raw inquiries from the public site). A quote can
link back to the request it came from (`quote_request_id`) and forward
to the order it became (`converted_order_id` / `orders.quote_id`).
Revisions are separate rows sharing the same `quote_number` +
`quote_year`, distinguished by `revision_number` — never overwritten in
place once sent, so a customer's history is always intact.

**pickup_appointments** — scheduling, separate from `orders.status`
for the same reason production_status is separate. `pickup_blocked_dates`
and `pickup_availability_settings` are shared between pickup scheduling
*and* production capacity planning (a holiday closes both).

**product_bom_parts / picket_purchases / picket_usage_allocations** —
the materials system. BOM parts define what a product needs; picket
purchases are real inventory (FIFO-costed); usage allocations record
actual consumption. Only cedar has real inventory tracking today —
`MATERIAL_INVENTORY_SOURCES` in `materialPlanning.ts` is where a second
material's inventory source would be added.

**order_build_sessions / order_progress_photos / product_checklist_items**
— Shop Floor Mode's data. Build sessions store actual elapsed time per
order, which is the raw data any future "estimated vs. actual" reporting
should read from — don't recompute actual time a different way elsewhere.

## Where the real logic lives (not duplicated per-page)

- `src/lib/orders.ts` — `createOrder()`. Every path that creates an
  order (admin order form, quote acceptance by a customer, quote
  acceptance by an admin) calls this same function. Never reimplement
  order creation in a route handler.
- `src/lib/quote.ts` / `quoteNumber.ts` / `tax.ts` — quote PDF
  generation, numbering, and tax math. Split across files specifically
  so client components can safely import the pure calculation pieces
  without pulling in server-only PDF/database code.
- `src/lib/materialPlanning.ts` — the one place "do I have enough
  material" is computed, used by the Dashboard, Manufacturing Queue,
  order pages, and the standalone Material Planning page.
- `src/lib/workflow.ts` — `getWorkflowStage()`, the one place an
  order's workflow stage is computed from its underlying fields.
- `src/lib/productionQueue.ts` — `sortProductionQueue()`, used
  identically by both Manufacturing Queue and Shop Floor Mode so they
  never show work in a different order from each other.
- `src/lib/productionCapacity.ts` / `pickupScheduling.ts` — capacity
  and scheduling calculations, kept separate from the pages that
  display them.
- `src/lib/orderTimeline.ts` — `getOrderTimeline()` /
  `getCustomerTimeline()`, the one place order/customer history is
  assembled, by reading from tables other flows already write to
  (order_status_history, invoices, quotes, proofs) rather than a
  separate event log.

## Where future features should plug in

- **New "is this order ready to do X" checks** → add to
  `materialPlanning.ts` or `productionCapacity.ts`, not inline in a page.
- **New order lifecycle event types for the timeline** → add a query to
  `getOrderTimeline()`, don't build a parallel history view.
- **New customer-facing scheduling/response actions** → follow the
  token-based pattern already used by proofs, quotes, and pickup
  appointments: a random token column, an admin-client lookup with no
  session required, disabled after use.
- **New payment processing** → `orders.payment_status` and
  `quotes.deposit_required_cents` already exist for exactly this,
  unused today by design. Wire a real processor into these columns
  rather than adding new ones.
- **A second material's inventory** → add its lookup function to
  `MATERIAL_INVENTORY_SOURCES` in `materialPlanning.ts`.

## Known, accepted trade-offs (not bugs)

- Bulk invoice PDF export (`/api/invoices/bulk`) fetches and zips PDFs
  sequentially rather than in parallel. Infrequently used and likely
  safer given typical zip-library constraints around concurrent writes
  — flagged during this audit, not treated as urgent.
- `orders` carrying many concerns (noted above) — acceptable at current
  scale, worth revisiting if it keeps growing.
