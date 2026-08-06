<div align="center">
  <img src="public/logo.svg" alt="RregulloKosovën" width="280" />
  <p><strong>Raporto problemin. Ndrysho qytetin.</strong></p>
  <p>A civic reporting platform for Kosovo — citizens report public infrastructure problems, municipalities resolve them in the open.</p>
</div>

---

## What it is

A citizen photographs a pothole, a broken street light, an uncollected bin.
Thirty seconds later it is a public record with a reference number, pinned on a
map, routed to the responsible municipality, and visible to every neighbour who
walks past the same problem. Other residents vote it up. The municipality moves
it through a status workflow and uploads proof when the work is done. Nobody can
quietly ignore it.

Think "Waze for city problems", built for all 38 municipalities of Kosovo.

## Architecture

One Next.js application — no separate backend, no Supabase, no Firebase, no paid
services.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Server Components + Server Actions remove the need for a separate API |
| Language | TypeScript (strict) | |
| UI | Tailwind CSS 3 + shadcn/ui (Radix) | Accessible primitives, owned in-repo |
| Motion | Framer Motion | Honours `prefers-reduced-motion` |
| Forms | React Hook Form + Zod | The same Zod schemas validate on client *and* server |
| Data | Prisma 6 + PostgreSQL (Neon free tier) | |
| Auth | Auth.js v5 (credentials, JWT sessions) | |
| Maps | Leaflet + marker clustering, OpenStreetMap tiles | No API key, no billing |
| Files | Cloudflare R2 via pre-signed PUT URLs | Free tier; binaries never touch the server |
| Charts | Recharts | |
| Tests | Vitest + Testing Library; Playwright script for E2E | |

### Why there is no API layer

Every mutation is a Server Action that validates with Zod, checks authorisation,
writes inside a transaction, and returns a uniform `ActionResult`. Every read is
a Server Component calling a query module directly. The browser downloads no
data-fetching code and there is no second place for authorisation to drift out
of sync.

```
src/
├── app/                      # routes (grouped: (marketing) (auth) (app) (dashboard))
├── components/
│   ├── ui/                   # shadcn primitives
│   ├── reports/ comments/ map/ uploads/ dashboard/ layout/
├── hooks/                    # client hooks (upload, geolocation, debounce)
├── lib/
│   ├── auth.ts               # Auth.js (Node runtime)
│   ├── auth.config.ts        # Edge-safe slice used by middleware
│   ├── authorization.ts      # pure policy — unit-tested, no framework imports
│   ├── permissions.ts        # session-bound guards that apply the policy
│   ├── rate-limit.ts  storage.ts  notifications.ts  badges.ts
│   └── ai/                   # classification seam (see ai/README.md)
├── server/
│   ├── actions/              # "use server" — all writes
│   └── queries/              # server-only reads
└── validations/              # Zod schemas shared by client and server
```

## Getting started

```bash
git clone <repo> && cd rregullojekosoven
npm install

cp .env.example .env          # fill in DATABASE_URL and AUTH_SECRET
npx prisma migrate deploy     # or: npm run db:migrate
npm run db:seed               # roles, 38 municipalities, categories, badges

npm run dev                   # http://localhost:3000
```

Generate a secret with `openssl rand -base64 32`.

### Demo data

```bash
SEED_DEMO=true \
SEED_ADMIN_EMAIL=admin@example.com \
SEED_ADMIN_PASSWORD='ChangeMe123' \
npm run db:seed
```

Adds 13 sample reports with votes, comments and realistic status histories, plus
these accounts (password `Demo1234`):

| Account | Role |
| --- | --- |
| `arta@shembull.com` | Citizen (Prishtinë) |
| `burim@shembull.com` | Citizen (Prizren) |
| `punonjes@prishtina.shembull.com` | Municipality employee |
| `admin@prishtina.shembull.com` | Municipality admin |

The seed is idempotent — reference data upserts, demo reports are skipped if any
report already exists — so it is safe to re-run against production.

### Without object storage

`R2_*` variables are optional. Leave them blank and everything works except
photo upload, which is hidden behind an explanatory notice rather than failing.

## Roles

| Role | Can |
| --- | --- |
| Visitor | Browse, search, filter, view the map |
| Citizen | + report, upload photos, vote, comment, follow, manage profile |
| Municipality employee | + manage reports **in their own municipality**, change status, add internal notes, upload proof |
| Municipality admin | + assign work to staff |
| Admin | + manage users, municipalities, categories; platform analytics; audit log |

Municipality staff are scoped to their own municipality by
`canManageReport()` — enforced server-side on every action, not just in the UI.

## Report workflow

```
PENDING ──► VERIFIED ──► ASSIGNED ──► IN_PROGRESS ──► COMPLETED
   │            │            │             │              │
   └──► REJECTED / DUPLICATE ┘             └──► ASSIGNED  └──► IN_PROGRESS (reopen)
```

Transitions are declared once in `STATUS_TRANSITIONS` (`src/lib/constants.ts`),
used to build the status dropdown, and re-checked in
`updateReportStatusAction` — a crafted request cannot skip `PENDING → COMPLETED`.
Every change writes a `status_history` row with author, timestamp and note, and
notifies the reporter plus everyone following.

## Security

- **Authorisation** is server-side on every action. Middleware only redirects; it
  is not the boundary. Dashboard layouts re-check with `requireRole()`.
- **Validation**: Zod on both sides; the server never trusts the client copy.
- **SQL injection**: all queries go through Prisma's parameterised client. The
  two `$queryRaw` calls in the analytics use tagged templates, never interpolation.
- **XSS**: user text renders as React children. The one string-built sink (the
  Leaflet popup) escapes every interpolated value.
- **Uploads**: MIME type and size re-validated server-side before a pre-signed
  URL is minted; the object key is server-generated; `ContentLength` is pinned so
  a signed URL cannot accept a larger body. Report images are rejected unless
  they came from our own bucket.
- **Passwords**: bcrypt (12 rounds), capped at 72 bytes. Login compares against a
  dummy hash for unknown accounts so response time does not reveal which emails exist.
- **Rate limiting**: sliding window on login, registration, reports, comments,
  votes and uploads. Login is limited on two axes — per (IP + email) and a looser
  per-IP cap — so shared NAT (normal for Kosovo households and municipal offices)
  cannot lock a whole building out.
- **Headers**: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy and
  a restrictive Permissions-Policy (`src/next.config.ts`).
- **Privacy**: IP addresses are salted-hashed before they are counted or logged;
  the raw value is never stored. Account deletion detaches reports rather than
  erasing the public record.

## Performance

- Server Components everywhere; the only client islands are vote, follow, share,
  comments, filters, uploader and maps.
- Counters (`score`, `commentsCount`, `followersCount`) are denormalised onto
  `reports` and updated in the same transaction, so feed queries never aggregate.
- Composite indexes back every list query — see the `@@index` lines in
  `prisma/schema.prisma`.
- Viewer vote/follow state is resolved in one extra query per page, not per row.
- Municipalities and categories are cached for an hour (`unstable_cache`) and
  invalidated by tag when an admin edits them.
- Leaflet loads client-side only; markers are drawn imperatively onto a cluster
  group rather than reconciled as React children.
- `next/image` with AVIF/WebP; above-the-fold cards opt out of lazy loading.

> **Do not add a `loading.tsx` to `/reports/[slug]`, `/profile/[username]`, or any
> ancestor segment.** A `loading.tsx` commits the HTTP response before rendering
> finishes, which downgrades `notFound()` to a soft 404 (200 status with
> not-found content) — search engines then index missing reports. This is
> verified in the E2E script.

## Accessibility

Skip link, one `<h1>` per page, labelled controls, `aria-pressed` on toggles,
`aria-live` on optimistic counters, visible focus rings, `lang="sq"`, semantic
tables with captions, and `prefers-reduced-motion` respected. Pinch-zoom is never
blocked.

## Testing

```bash
npm test              # 62 unit tests (Vitest)
npm run test:coverage
npm run typecheck
npm run lint
```

Unit tests cover the authorization policy, all Zod schemas, the rate limiter, the
AI heuristics and the formatting/geo utilities.

End-to-end (needs a running build and a seeded database):

```bash
npm run build && npm start -- -p 3200 &
node tests/e2e/verify.mjs      # 49 checks across all four roles
node tests/e2e/workflow.mjs   # 8 checks on the municipal status workflow
```

These drive a real browser: Leaflet mounting, optimistic voting and its exact
rollback, comment posting, role isolation, dashboards, dark mode, mobile overflow
and accessibility basics.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the Vercel + Neon + R2 walkthrough.

## Future AI

`src/lib/ai/classifier.ts` is the single seam for category suggestion, priority
prediction and duplicate scoring. Today these are deterministic Albanian keyword
heuristics; the signatures are the contract, so swapping in a model touches no
call site. Guesses are stored in `reports.ai_*` **alongside** the citizen's own
choices, never overwriting them — which also makes accuracy measurable. See
[`src/lib/ai/README.md`](./src/lib/ai/README.md).

## Licence

Built for the citizens of Kosovo.
