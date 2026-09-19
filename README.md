# DineFlow — Multi-Tenant Restaurant Operations SaaS

A production-grade SaaS platform for multi-location restaurants: reservations, branches, menus, customers, staff, and analytics — with strict multi-tenant data isolation.

![Stack](https://img.shields.io/badge/Next.js%2015-App%20Router-black) ![DB](https://img.shields.io/badge/MongoDB-Mongoose-47A248) ![Auth](https://img.shields.io/badge/Auth.js-v5-purple)

## Features

**Public site**
- Marketing pages (home, features, pricing) with Framer Motion animations
- Public branch directory with debounced search
- Searchable, filterable public menu (tracks view events for analytics)
- Capacity-aware public booking flow

**SaaS dashboard**
- Overview: today's reservations, revenue, occupancy, customer growth + Recharts trend charts
- Branch management with utilization tracking
- Menu management (categories, allergens, prep times, availability toggles)
- Reservation lifecycle: `pending → approved → seated → completed` with enforced status transitions; completing a reservation records a customer visit and revenue
- Customer CRM: profiles, visit history, lifetime spend, tags
- Staff management: scoped roles, branch/shift assignment, activate/deactivate
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

## Deployment

Deploys cleanly to Vercel: set `MONGODB_URI`, `AUTH_SECRET`, and `AUTH_TRUST_HOST=true` in project env vars and push.
