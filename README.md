# DineFlow — Multi-Tenant Restaurant Operations SaaS

A production-grade SaaS platform for multi-location restaurants: reservations, branches, menus, customers, staff, and analytics — with strict multi-tenant data isolation.

Built for Bangladesh: all amounts are in BDT (৳, lakh/crore grouping), dates and times follow Bangladesh time (`Asia/Dhaka`), and addresses use divisions and postal codes. These defaults live in `src/lib/constants.ts`.

![Stack](https://img.shields.io/badge/Next.js%2015-App%20Router-black) ![DB](https://img.shields.io/badge/MongoDB-Mongoose-47A248) ![Auth](https://img.shields.io/badge/Auth.js-v5-purple)

## Features

**Public site**
- Marketing pages (home, features, pricing) with Framer Motion animations
- A public page per restaurant at `/r/<slug>`: profile, locations with real opening hours, full menu, and booking
- Live availability: guests only see slots inside opening hours where a table actually fits their party
- Guests manage their own booking from a signed link: view, change the time or cancel, no account needed
- Emails for every step: booking received, confirmed, cancelled, and a reminder the day before
- Public branch directory and searchable menu across published restaurants
- Guest portal at `/account`: guests sign in with an emailed link (no password) and see every booking, visit and loyalty balance across all DineFlow restaurants they have booked with
- After a visit, guests get a "How was it?" email and rate it 1–5 stars with a comment; restaurant pages show the average rating and recent reviews with replies

**SaaS dashboard**
- Overview: today's reservations, revenue, occupancy, customer growth + Recharts trend charts
- Branch management with utilization tracking
- Menu management (categories, allergens, prep times, availability toggles)
- Reservation lifecycle: `pending → approved → seated → completed` with enforced status transitions; completing a reservation records a customer visit and revenue
- Customer CRM: profiles, visit history, lifetime spend, tags
- Staff management: scoped roles, branch/shift assignment, activate/deactivate
- Settings: restaurant profile, publish/unpublish the public page, and booking rules (table hold time, slot interval, party size, lead time, how far ahead, auto-approve)
- Weekly opening hours and holiday closures per branch; bookings are checked against both
- Tables per branch (seats, zone), and a Floor view: a day timeline of tables against time where bookings can be dragged to another table, approved, seated, completed or marked no-show
- Walk-ins and a waitlist: seat a party straight away, or hold them and seat them when a table frees up
- Notification bell for new bookings, cancellations and waiting parties
- Activity log: who approved, moved, seated or cancelled what
- Invite staff by email so they set their own password, plus a forgotten-password flow
- Orders: open a ticket for a seated booking or a table, add dishes at today's prices, send them to the kitchen, and close the bill
- Kitchen screen: tickets as they are sent, moved through cooking → ready → served, with a timer that turns red after 20 minutes
- Bills in BDT with service charge, VAT and discounts; paid by cash, card, bKash, Nagad or Rocket, with change worked out for you
- Feedback: every review with rating summary and filters; owners and managers reply (emailed to the guest) or hide a review from the public page; a notification for each new review
- Loyalty points: owners set the earn rate, point value and redemption minimum; guests attached to a bill earn points on the food they pay for, and staff redeem points as taka off at the till; each guest's balance has a full ledger, with manual adjustments by managers
- Billing: Starter, Growth and Enterprise plans with branch, staff, analytics and loyalty limits enforced on the server; owners pay monthly or yearly through SSLCommerz (bKash, Nagad, Rocket, cards, net banking) and get a numbered invoice and an emailed receipt
- New restaurants get a 14-day free trial. When a paid plan ends there is a 7-day grace period; after that the dashboard becomes read-only and online booking pauses until the owner renews, with reminder emails before and after
- Payments are only counted after SSLCommerz's validation service confirms them, whether the owner's browser returns first or SSLCommerz's IPN does; payments SSLCommerz flags as risky wait for DineFlow to approve them
- Admin console at `/admin` for DineFlow's own team: every restaurant's plan and status, monthly recurring revenue, payments, and support actions (free days, plan change, suspend or reinstate), each recorded in the restaurant's activity log
- Photos: owners upload a logo, branch cover photos and dish photos (JPEG, PNG or WebP). They are resized in the browser, checked on the server and stored on Cloudinary in a folder per restaurant, then served at the right size for each screen. Replaced or deleted photos are removed from Cloudinary too
- Personal profile page with password change, and a light/dark theme toggle
- Analytics: revenue, reservation, customer, branch, and menu popularity aggregations (server-side MongoDB pipelines)

**Architecture**
- Multi-tenant: every business document carries `restaurantId`; every dashboard query goes through `requireTenantSession()` + `tenantFilter()` so cross-tenant access is impossible by construction
- RBAC: five roles (`super_admin`, `owner`, `manager`, `staff`, `customer`) enforced at middleware, layout, and API layer
- REST API with Zod validation, consistent error envelopes, and pagination everywhere
- Auth.js v5 (JWT sessions) with edge-safe middleware config

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn-style UI · Framer Motion · TanStack Query · React Hook Form + Zod · MongoDB + Mongoose · Auth.js (NextAuth v5) · Recharts

## Getting started

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env.local
# set MONGODB_URI (local MongoDB or Atlas) and AUTH_SECRET

# 3. Seed demo data (2 tenants, 90 days of history)
npm run seed

# 4. Run
npm run dev
```

### Checks

```bash
npm run lint       # ESLint (next/core-web-vitals + TypeScript)
npm run typecheck  # tsc --noEmit
npm test           # Vitest: unit tests + API integration tests
npm run test:e2e   # Playwright: the built app in a real browser
```

Integration tests call the real route handlers against an in-memory MongoDB (`mongodb-memory-server`, downloaded on first run). They cover tenant isolation, staff branch scoping, session revalidation, the reservation lifecycle, capacity (including two bookings racing for the last seats) and rate limiting.

End-to-end tests (`e2e/`) drive Chromium through sign-in, role routing, a guest booking and cancelling from the storefront, tenant isolation and a lapsed subscription. `scripts/e2e-server.ts` starts its own in-memory MongoDB, seeds the fixture in `e2e/fixture.ts`, builds into `.next-e2e` and serves on port 3100, so it never touches your `.env.local` database or a running `npm run dev`. Install the browser once with `npx playwright install chromium`; set `E2E_SKIP_BUILD=1` to reuse the last build while editing specs.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck and Vitest in one job and the build plus Playwright in another, on every push to `main` and every pull request. A failed run uploads the Playwright report (traces and screenshots) as an artifact.

### Demo accounts (password: `password123`)

| Email | Role |
| --- | --- |
| `owner@ember-oak.com` | Owner — full access |
| `manager@ember-oak.com` | Manager — no branch deletion, can't create managers |
| `staff@ember-oak.com` | Staff — reservations, menu availability only |

Guest portal: open `/account` and enter `guest@example.com`. Without `RESEND_API_KEY` the sign-in link is printed in the dev server log.

DineFlow admin: `admin@dineflow.app` (same password) opens `/admin`. Ember & Oak is a paying Growth customer; Sakura Table (`owner@sakura-table.com`) is on a trial that ends in 5 days.

### Subscription payments

Add SSLCommerz sandbox credentials to `.env.local` (see `.env.example`) and pay from Dashboard → Billing. The sandbox's test page lets you choose *Success*, *Success with risk* (held for review in `/admin`) or *Failed*. SSLCommerz's IPN needs a public URL, so locally it cannot reach you; the payment is still confirmed when the browser returns. Run the daily jobs with `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/subscriptions`.
| `owner@sakura-table.com` | Owner of a second tenant (verifies isolation) |

## Project structure

```
src/
├── app/
│   ├── (marketing)/        # public site: home, features, pricing, branches, menu, reserve, contact
│   ├── (auth)/             # login, register
│   ├── dashboard/          # tenant dashboard (overview, branches, menu, reservations, customers, staff, analytics)
│   └── api/                # REST route handlers (Zod + tenant scoping)
├── components/
│   ├── ui/                 # shadcn-style primitives
│   ├── shared/             # stat cards, empty states, pagination, confirm dialogs
│   ├── marketing/          # navbar, footer, animations
│   └── dashboard/          # sidebar, topbar, charts, module dialogs
├── models/                 # Mongoose schemas (all tenant-scoped)
├── lib/                    # db, auth helpers, api helpers, validations, analytics
└── auth.ts / auth.config.ts / middleware.ts
```

## Multi-tenancy model

Every business collection (`branches`, `menuItems`, `reservations`, `customers`, `analyticsEvents`, staff `users`) includes an indexed `restaurantId`. API routes resolve the tenant from the **session**, never from client input:

```ts
const ctx = await requireTenantSession();          // 401/403 if no tenant context
await Branch.find({ ...filter, ...tenantFilter(ctx) }); // always scoped
```

The public booking endpoint derives `restaurantId` from the selected branch document after validating it exists and is active.

## Seating

A branch with tables seats every booking on real tables: the smallest table that fits, or several joined within one zone for a large party. Availability, walk-ins and reschedules all go through the same fit check, and two bookings racing for the last table resolve so exactly one keeps it. A branch with no tables falls back to total seat capacity, so tables are optional.

## Email

Transactional email goes through Resend. Set `RESEND_API_KEY` and `EMAIL_FROM` (a verified sender) to send for real; without them every message is logged to the console, so development and tests need no credentials. Sending never throws — a failed email cannot fail the booking that triggered it.

Reminders are sent by `GET /api/cron/reminders`, which needs `CRON_SECRET` as a bearer token and emails each guest booked for the next day exactly once. `vercel.json` schedules it daily at 10:00 Dhaka time; any scheduler that can call a URL works just as well.

## Money

Revenue comes from paid orders. A paid bill records the total, completes its booking and adds the real spend to the guest's history; `Reservation.orderId` marks bookings already billed, so a completed booking without an order still counts through its estimated spend and nothing is counted twice.

Bills are `subtotal − discount`, then service charge and VAT on that amount, both configurable per restaurant in Settings (Bangladeshi defaults: 5% VAT, 10% service). Prices and dish names are copied onto the ticket when ordered, so changing the menu later never rewrites an old bill.

## Booking rules

Each restaurant owns its rules (`Restaurant.bookingSettings`), applied in `src/lib/availability.ts`:

| Rule | Meaning |
| --- | --- |
| `diningDurationMinutes` | How long a party holds its seats; drives overlap-aware capacity |
| `slotIntervalMinutes` | Gap between bookable times |
| `maxPartySize` | Largest party bookable online |
| `minLeadMinutes` | How close to a slot a guest may still book |
| `maxDaysAhead` | How far ahead bookings open |
| `autoApprove` | Confirm online bookings instead of leaving them pending |

Guests get every rule. Staff taking a phone booking skip the lead-time and how-far-ahead limits, but opening hours, closures and capacity still apply.

## Deployment

Deploys cleanly to Vercel: set `MONGODB_URI`, `AUTH_SECRET`, and `AUTH_TRUST_HOST=true` in project env vars and push.

## Monitoring

- **Health check:** `GET /api/health` pings MongoDB and returns `200 {"status":"ok"}`, or `503` when the database is unreachable. Point an uptime monitor (UptimeRobot, Better Stack, etc.) at it. It also reports the deployed commit on Vercel.
- **Logs:** server code logs through `src/lib/logger.ts`. In production each entry is one JSON line (`time`, `level`, `msg`, plus fields such as `errorId`, `path` or `error.stack`), so Vercel's log search can filter by field. `LOG_LEVEL` (`debug`, `info`, `warn`, `error`, `silent`) sets the threshold; the default is `info` in production.
- **Error references:** an unexpected API error returns a message with an 8-character reference (`errorId`) that is also in the log line. Page errors show Next's digest as "Reference". Search the logs for the reference a user reports.
- **Uncaught errors:** `src/instrumentation.ts` logs every server error Next.js catches (pages, route handlers, server actions, middleware) with its route.
- **Scheduled jobs:** each cron run logs a summary (`Cron: … finished`) with what it considered and sent.
