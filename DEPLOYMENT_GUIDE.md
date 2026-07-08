# Deployment Guide (no coding required)

This walks you through putting the website live on the internet. You'll
create three free accounts (Supabase, Resend, Vercel), connect them
together with some settings I'll point you to exactly, and you're live.
Budget about 45–60 minutes for the first time through.

---

## 1. Create your database (Supabase)

1. Go to supabase.com and sign up (free).
2. Click **"New project."** Name it `sunrise-wood-creations`, set a
   database password (save it somewhere safe), pick the region closest to
   Michigan, and create it. Wait ~2 minutes for it to spin up.
3. In the left sidebar, click **SQL Editor** → **New query**.
4. Open the file `supabase/schema.sql` from this project, copy everything,
   paste it into the SQL editor, and click **Run**. This builds every
   table the site needs.
5. In the left sidebar, click **Project Settings → API**. You'll need
   three values from this page in a minute:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click "reveal" — keep this one extra private)
6. Click **Authentication → Providers** and make sure **Email** is enabled
   (it is by default).
7. Click **Authentication → URL Configuration**. Set **Site URL** to your
   real website address (e.g. `https://sunrisewoodcreations.com`) once you
   have it — you can update this later if you don't have a domain yet.
8. (Optional, recommended later) Click **Authentication → Email
   Templates** — you can customize the wording of the "invite" and
   "reset password" emails here to sound more like your business.

---

## 2. Create your email-sending account (Resend)

This is what actually sends the order-update and proof emails.

1. Go to resend.com and sign up (free tier covers small businesses easily).
2. Click **API Keys → Create API Key**. Copy it — you'll paste it into a
   settings file in step 4.
3. Click **Domains → Add Domain** and enter your website's domain (e.g.
   `sunrisewoodcreations.com`). Resend will show you some DNS records to
   add. If you buy your domain through a registrar like GoDaddy or
   Namecheap, you paste those records into that registrar's DNS settings
   page (I can walk you through this once you've picked a domain — every
   registrar's screen looks a little different).
   - If you don't have a domain yet, you can still test everything using
     Resend's default sending address in the meantime.

---

## 3. Put the code on GitHub

GitHub just stores your code so Vercel (the next step) can find it.

1. Go to github.com and sign up (free).
2. Click **New repository**, name it `sunrise-wood-creations`, keep it
   **Private**, and create it.
3. On your computer, unzip the project folder I gave you, then follow the
   "upload an existing folder" instructions GitHub shows you on the new
   repository's page (there's a drag-and-drop option in the browser — no
   command line needed).

---

## 4. Deploy it (Vercel)

1. Go to vercel.com and sign up using your GitHub account.
2. Click **Add New → Project**, and pick the `sunrise-wood-creations`
   repository you just uploaded.
3. Before clicking Deploy, open **Environment Variables** and add these
   (copy the names exactly):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Supabase step 5 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase step 5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 5 |
   | `RESEND_API_KEY` | from Resend step 2 |
   | `EMAIL_FROM` | `Sunrise Wood Creations <orders@yourdomain.com>` |
   | `SHOP_NOTIFY_EMAIL` | `sunrisewoodcreations@gmail.com` |
   | `NEXT_PUBLIC_SITE_URL` | your Vercel address for now, e.g. `https://sunrise-wood-creations.vercel.app` |

4. Click **Deploy**. In a minute or two, you'll get a working link — that's
   your live site.
5. Go back to Supabase → Authentication → URL Configuration and update
   **Site URL** to match this real address.

---

## 5. Connect your real domain name (optional, do this whenever you buy one)

1. In Vercel, open your project → **Settings → Domains** → add your
   domain.
2. Vercel shows you one or two DNS records to add at whatever place you
   bought the domain (GoDaddy, Namecheap, etc).
3. Update `NEXT_PUBLIC_SITE_URL` in Vercel's environment variables to your
   real domain, and update Supabase's Site URL to match too.

---

## 6. Create your own (admin) login

Since your email is hardcoded as the admin account
(`sunrisewoodcreations@gmail.com`), just:

1. Go to your live site → **Login** → **Forgot password?**
2. Enter `sunrisewoodcreations@gmail.com` and check that inbox for the
   link — this is actually how you'll set your very first password,
   since no invite is needed for the built-in admin account.

Wait — one extra one-time step first: since your admin account doesn't
exist yet, you need to create it once in Supabase directly:
1. Supabase → **Authentication → Users → Add user**.
2. Email: `sunrisewoodcreations@gmail.com`. Check **"Auto confirm user."**
3. Set a temporary password (anything).
4. Now go do the "Forgot password?" step above on your live site to set
   the real password you want to use going forward.

---

## 7. Try the whole flow once

1. As admin, go to **Customers → Add a new customer** with your own
   personal email, so you can see the invite email land.
2. Click the link in that email, set a password, and you're on the
   customer dashboard.
3. As admin again, add an order for that test customer, move its status
   along, and confirm the email arrives each time.
4. If it's a cornhole order, send yourself a proof and try approving and
   declining it.

If any step in emails doesn't arrive, double-check the `RESEND_API_KEY`
and `EMAIL_FROM` values in Vercel first — that's the most common hiccup.

---

## Ongoing use — nothing below this line needs a developer

Once it's live, everything day-to-day happens by logging into
`/admin` on your site: adding customers, adding orders, moving the
progress bar, and sending proofs. No code, no dashboards outside your own
site required.
