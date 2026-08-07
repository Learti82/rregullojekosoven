# Deployment

## Quick start (about 3 minutes, no terminal)

The build initialises the database itself — it applies migrations and seeds the
38 municipalities, categories, roles and badges on every deploy. You do not run
any commands locally.

1. **Import the repo** at [vercel.com/new](https://vercel.com/new).
2. **Vercel → Storage → Create Database → Neon.** Free; it sets `DATABASE_URL`
   for you. (`DIRECT_DATABASE_URL` is optional — the setup script falls back to
   `DATABASE_URL` when it is absent.)
3. **Settings → Environment Variables**, add:

   | Variable | Value |
   | --- | --- |
   | `AUTH_SECRET` | `openssl rand -base64 32` |
   | `RESEND_API_KEY` | free key from [resend.com](https://resend.com) — **without it nobody can sign in** |
   | `EMAIL_FROM` | e.g. `RregulloKosovën <njoftime@yourdomain.org>` |
   | `SEED_ADMIN_EMAIL` | your email — makes you the administrator |
   | `CRON_SECRET` | `openssl rand -base64 32` — enables the scheduled jobs |
   | `NEXT_PUBLIC_APP_URL` | your Vercel URL |
   | `NEXT_PUBLIC_ADS_WHATSAPP` | your WhatsApp number, digits only |

   There is no admin password to set. Sign-in is passwordless: you enter your
   email, the app sends a 6-digit code, and that is the whole login. Whoever can
   read the `SEED_ADMIN_EMAIL` inbox is the administrator — use an address you
   control and keep it secure.

4. **Redeploy**, then open `/api/health`. `"status": "ok"` means you are live.

That is the whole setup. Everything below is detail for when you want more
control — a first deploy needs none of it.

> A first deploy without any variables still **builds and goes live**; the pages
> then explain what is missing rather than the build failing. Check
> `/api/health` any time something looks wrong.

---

## How the automatic setup behaves

`npm run build` runs `scripts/deploy-setup.mjs` before `next build`:

| Situation | What happens |
| --- | --- |
| No `DATABASE_URL` | Logs what is missing, build succeeds, site explains itself |
| Empty database | Creates all 22 tables, seeds reference data |
| Already set up | Migrations skipped (tracked), seed upserts — nothing duplicates |
| `SEED_ADMIN_EMAIL` set | Grants that address the ADMIN role (creates the account if new) |
| Database unreachable | Build **fails** loudly rather than shipping a broken schema |

Set `SKIP_DB_SETUP=true` once you would rather apply migrations deliberately —
sensible when the platform has real traffic and a schema change needs a
maintenance window.

Demo reports are never created automatically; that still requires
`SEED_DEMO=true`.

---

Target stack: **Vercel** (app) + **Neon** (PostgreSQL) + **Cloudflare R2** (images).
All three have free tiers sufficient to launch; nothing here requires a paid plan.

---

## 1. Database — Neon

**Fastest path if you already deploy on Vercel:** in the project, go to
**Storage → Create Database → Neon**. Vercel provisions a free Neon database and
injects `DATABASE_URL` automatically. It also sets an unpooled variant (named
`DATABASE_URL_UNPOOLED` or `POSTGRES_URL_NON_POOLING` depending on the
integration version) — copy that value into a variable named
`DIRECT_DATABASE_URL`, which is what `prisma migrate` uses. You still need to set
`AUTH_SECRET` yourself.

Otherwise, set it up directly:

1. Create a project at [neon.tech](https://neon.tech). Pick the region closest to
   Kosovo — **AWS eu-central-1 (Frankfurt)** — so round-trips stay under ~30ms.
2. From the dashboard, copy **two** connection strings:
   - the **pooled** one (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one → `DIRECT_DATABASE_URL`

Serverless functions open many short-lived connections, so application queries
must go through the pooler. Prisma Migrate needs a session-level connection and
uses the direct URL — this is why the schema declares both.

Apply the schema:

```bash
DATABASE_URL="<pooled>" DIRECT_DATABASE_URL="<direct>" npx prisma migrate deploy
```

Seed reference data (roles, all 38 municipalities, categories, badges) and create
the first administrator:

```bash
DATABASE_URL="<pooled>" DIRECT_DATABASE_URL="<direct>" \
SEED_ADMIN_EMAIL="admin@yourdomain.org" \
npm run db:seed
```

Leave `SEED_DEMO` unset in production. The seed is idempotent, so re-running it
after adding a municipality is safe.

> Neon's free tier suspends a database after inactivity; the first request then
> pays a cold start of a few hundred milliseconds. Enable Neon's autoscaling or
> upgrade if that matters for launch day.

---

## 2. Object storage — Cloudflare R2

Optional. Without it the app runs, but photo upload is hidden behind a notice.

1. Cloudflare dashboard → **R2** → create bucket `rregullokosoven`.
2. **Settings → Public access**: enable the `r2.dev` subdomain, or connect a
   custom domain (recommended for production). Copy that base URL →
   `R2_PUBLIC_URL`.
3. **Manage R2 API Tokens** → create a token with **Object Read & Write** scoped
   to this bucket. Copy the access key id and secret.
4. Set `R2_ACCOUNT_ID` (from the R2 overview page) and `R2_BUCKET_NAME`.

Add a CORS policy so browsers may `PUT` directly to the pre-signed URL:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.org"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["etag"],
    "MaxAgeSeconds": 3600
  }
]
```

Add `http://localhost:3000` to `AllowedOrigins` while developing.

The server never receives image bytes: it validates type and size, mints a
5-minute pre-signed `PUT` with a pinned `Content-Length` and a server-generated
key, and the browser uploads straight to R2. That keeps large files off the
function budget entirely.

### UploadThing instead

If you prefer UploadThing's free tier, reimplement the three exported functions
in `src/lib/storage.ts` (`createPresignedUpload`, `deleteObjects`,
`isOwnedStorageUrl`). Nothing else imports the storage SDK.

---

## 3. Application — Vercel

1. Import the repository at [vercel.com/new](https://vercel.com/new). The
   framework preset is detected automatically.
2. Build command stays `npm run build` — it runs `prisma generate` first, which
   is required because Vercel caches `node_modules` between builds and the
   generated client would otherwise go stale.
3. Add the environment variables below (Production **and** Preview):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** string |
| `DIRECT_DATABASE_URL` | Neon **direct** string |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | `https://your-domain.org` |
| `RATE_LIMIT_SALT` | any long random string |
| `R2_ACCOUNT_ID` … `R2_PUBLIC_URL` | from step 2 (optional) |
| `NEXT_PUBLIC_ADS_WHATSAPP` | WhatsApp number for ad enquiries, digits only (e.g. `38344123456`) |
| `NEXT_PUBLIC_ADS_ENABLED` | `true`, or `false` to hide every ad slot |

4. Deploy, then add your custom domain under **Settings → Domains**.

Set `NEXT_PUBLIC_APP_URL` to the real domain before launch — canonical URLs, Open
Graph tags, the sitemap and share links are all built from it.

### Migrations on deploy

`prisma migrate deploy` is deliberately **not** part of the build: a failed
migration would leave a half-deployed app, and Vercel builds can run
concurrently. Run it as a deliberate step before promoting:

```bash
DATABASE_URL="<pooled>" DIRECT_DATABASE_URL="<direct>" npx prisma migrate deploy
```

Or wire it into a CI job gated on the migration succeeding.

---

## 4. Post-deploy checklist

```bash
curl -s https://your-domain.org/api/health           # {"status":"ok",...} — check this first
curl -I https://your-domain.org                      # 200 + security headers
curl -s https://your-domain.org/robots.txt
curl -s https://your-domain.org/sitemap.xml | head
curl -o /dev/null -w '%{http_code}\n' https://your-domain.org/reports/does-not-exist   # must be 404
```

- [ ] Sign in with the seeded admin — enter the address, then the code emailed to it.
      If no email arrives, `RESEND_API_KEY` is missing or `EMAIL_FROM` uses an
      unverified domain; both show up in `/api/health`.
- [ ] `/admin/municipalities` lists all 38 municipalities.
- [ ] Promote real municipal staff at `/admin/users` and bind each to a municipality.
- [ ] File a test report end to end, including a photo. It should **not** appear on
      `/map` yet — approve it at `/admin/moderation`, then confirm it does.
- [ ] Move that report through `VERIFIED → ASSIGNED → IN_PROGRESS → COMPLETED`
      and confirm the reporter is notified at each step.
- [ ] Click an ad slot and confirm WhatsApp opens to the right number.
- [ ] Toggle municipality boundaries on the map and confirm all 38 outlines draw.
- [ ] Submit the sitemap in Google Search Console.
- [ ] Confirm the missing-report URL above returns **404**, not 200 — see the
      `loading.tsx` warning in the README.

---

## 5. Operations

**Approving reports.** Citizen submissions are private until you approve them at
`/admin/moderation`. The nav badge shows how many are waiting, and
`/api/cron/moderation-digest` emails you twice a day whenever the queue is not
empty (07:00 and 19:00 UTC — roughly morning and evening in Kosovo).

The endpoint enforces its own 11-hour minimum between sends, so it is safe to
call by hand or from any external scheduler:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain.org/api/cron/moderation-digest
```

Cron schedules and how many jobs a project may have are limited by Vercel plan —
check the current limits for your plan in the Vercel dashboard under
**Settings → Cron Jobs**. If your plan will not run the twice-daily schedule in
`vercel.json`, drop one of the two entries, or point an external scheduler (e.g.
[cron-job.org](https://cron-job.org), free) at the URL above; the endpoint's own
rate limit means nothing breaks either way.

**Rate limiting.** The default limiter is in-process. On a single server it is
exact; on Vercel's serverless runtime each warm instance keeps its own counters,
so the effective limit is per-instance. That bounds abuse but is not global. When
traffic justifies it, implement `RateLimitStore` against Redis or a Postgres
table and register it once at startup:

```ts
import { setRateLimitStore } from "@/lib/rate-limit";
setRateLimitStore(mySharedStore);
```

No call site changes.

**Storage.** Measured on real data: about **3.5 KB per report**, including its
comments, status history, notifications and every index. A 0.5GB tier therefore
holds roughly **145,000 reports** — years of national activity, because photos
live in R2 and never touch the database.

The tables that actually threaten a quota are the ones that grow with *activity*
rather than content: `activity_logs` (one row per sign-in, vote, status change)
and `notifications` (one row per recipient per event). `/api/cron/cleanup` prunes
them daily — audit logs older than a year, already-read notifications older than
90 days, expired sessions, spent sign-in codes. Reports, comments and votes are
never deleted.

Set `CRON_SECRET` to enable it; without that secret the endpoint refuses every
request rather than leaving deletion open to anyone who finds the URL. The same
secret guards `/api/cron/moderation-digest`. Both schedules live in `vercel.json`.

**Backups.** Neon keeps point-in-time history on the free tier (retention varies).
For an independent copy:

```bash
pg_dump "$DIRECT_DATABASE_URL" -Fc -f backup-$(date +%F).dump
```

**Audit trail.** `/admin/logs` shows sign-ins, status changes, role changes and
bans. IPs are stored only as salted hashes. `activity_logs` grows without bound —
schedule a periodic prune (e.g. delete rows older than a year) once the platform
is busy.

**Health check.** `GET /api/health` reports which environment variables are set
(presence only — never values) and whether the database answers, returning 503
when something required is missing. Point an uptime monitor at it.

**Monitoring.** Vercel Analytics covers Web Vitals. Watch Neon's connection count;
if it climbs, confirm the pooled URL is the one in `DATABASE_URL`.

**Scaling notes.** The schema is indexed for national volume, and feed queries
read denormalised counters rather than aggregating. The first things to watch as
traffic grows: `/map` currently returns the 500 most recent matching markers —
move to viewport-bounded queries when a single municipality routinely exceeds
that; and `activity_logs` insert volume, which is the highest-write table.

---

## 6. Build-log notes

A clean deployment log should be free of these. If you see them:

**`[sitemap] Error: DATABASE_URL is not set`** — the sitemap now renders per
request, so this no longer appears during the build. At runtime it means exactly
what it says: the variable is unset. Check `/api/health`.

**`Detected "engines": { "node": ">=20.0.0" } ... will automatically upgrade`** —
fixed by pinning `engines.node` to `22.x`. An open-ended range lets the platform
jump to the next Node major the day it ships, which can break a build with no
change on your side.

**`package.json#prisma is deprecated`** — fixed by moving that config to
`prisma.config.ts`, which Prisma 7 will require. Because a config file does not
auto-load `.env`, that file loads it explicitly so local `prisma migrate` and
`db:seed` keep working.

---

## 7. Self-hosting

Any Node 20+ host works:

```bash
npm ci
npx prisma migrate deploy
npm run build
npm start                 # PORT=3000 by default
```

Put Nginx or Caddy in front for TLS. Behind a proxy, forward `X-Forwarded-For` —
the rate limiter reads it to identify callers — and set `AUTH_URL` to the public
origin so Auth.js builds correct callback URLs.
