# Sunrise Wood Creations — website + customer/admin portal

This is a full Next.js application: public marketing site, gated customer
login with order tracking, and an admin dashboard for managing customers
and orders.

**Start here:** `DEPLOYMENT_GUIDE.md` — step-by-step, no-coding-required
instructions to get this live on the internet.

## What's inside
- `src/app` — every page of the site (public pages, `/login`, `/account`, `/admin`)
- `src/app/api` — the backend logic (creating customers, updating order status, sending emails, generating invoices)
- `src/components` — reusable pieces (progress bar, forms, etc.)
- `src/lib` — database connection helpers, email templates, and the progress-step definitions
- `supabase/schema.sql` — the database structure; run this once when setting up Supabase
- `middleware.ts` — keeps people logged in and keeps customers out of the admin area

## Changing product/status wording
Almost all customer-facing wording for order statuses lives in one file:
`src/lib/statusSteps.ts`. Change it there and it updates the progress bar,
admin dropdown, and email wording everywhere at once.
