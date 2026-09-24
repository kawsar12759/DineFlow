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
- Public branch directory and searchable menu across published restaurants

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
```

Integration tests call the real route handlers against an in-memory MongoDB (`mongodb-memory-server`, downloaded on first run). They cover tenant isolation, staff branch scoping, session revalidation, the reservation lifecycle, capacity (including two bookings racing for the last seats) and rate limiting.

### Demo accounts (password: `password123`)

| Email | Role |
| --- | --- |
| `owner@ember-oak.com` | Owner — full access |
| `manager@ember-oak.com` | Manager — no branch deletion, can't create managers |
| `staff@ember-oak.com` | Staff — reservations, menu availability only |
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
