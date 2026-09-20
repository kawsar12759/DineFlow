import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Globe,
  Lock,
  Search,
  ShieldCheck,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FadeUp, Stagger, StaggerItem } from "@/components/marketing/animated";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Explore DineFlow's platform capabilities: reservations, multi-branch management, menu engineering, CRM, staff, and analytics.",
};

const featureGroups = [
  {
    heading: "Front of house",
    items: [
      {
        icon: CalendarCheck,
        title: "Reservation workflows",
        description:
          "Pending → approved → seated → completed. Full lifecycle tracking with capacity-aware slot validation that blocks overbooking automatically.",
      },
      {
        icon: Bell,
        title: "Real-time status board",
        description:
          "Hosts see every upcoming party, special request, and table state at a glance — filtered by branch and date.",
      },
      {
        icon: Users,
        title: "Guest profiles",
        description:
          "Every booking builds the CRM: visit counts, lifetime spend, allergy notes, and tags for VIPs or regulars.",
      },
    ],
  },
  {
    heading: "Back of house",
    items: [
      {
        icon: ChefHat,
        title: "Menu engineering",
        description:
          "Centralized catalog with categories, allergens, prep times, photos, and per-branch availability toggles.",
      },
      {
        icon: Store,
        title: "Branch operations",
        description:
          "Capacity, opening hours, and contact details per location — with utilization tracking against real covers.",
      },
      {
        icon: ClipboardList,
        title: "Staff & shifts",
        description:
          "Invite managers and staff with scoped permissions, assign branches and shifts, and deactivate access instantly.",
      },
    ],
  },
  {
    heading: "Intelligence & trust",
    items: [
      {
        icon: BarChart3,
        title: "Unified analytics",
        description:
          "Revenue, reservations, occupancy, customer growth, and menu popularity — aggregated server-side from live data.",
      },
      {
        icon: ShieldCheck,
        title: "Role-based access control",
        description:
          "Five roles with strict permission boundaries. Staff toggle availability; only owners delete branches.",
      },
      {
        icon: Lock,
        title: "Tenant isolation",
        description:
          "Every query is scoped to your restaurant. Your data is never visible to another tenant — by architecture, not policy.",
      },
      {
        icon: Search,
        title: "Fast everywhere",
        description:
          "Debounced search, indexed queries, and paginated lists keep the dashboard snappy at any scale.",
      },
      {
        icon: Globe,
        title: "Public storefront",
        description:
          "A branded branch directory, searchable menu, and booking page — live the moment you publish.",
      },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="container py-20">
      <FadeUp className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Platform capabilities
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          One system of record for everything that happens between “table for
          two?” and the end-of-month report.
        </p>
      </FadeUp>

      <div className="mt-16 space-y-16">
        {featureGroups.map((group) => (
          <section key={group.heading}>
            <FadeUp>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-primary">
                {group.heading}
              </h2>
            </FadeUp>
            <Stagger className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <StaggerItem key={item.title}>
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardContent className="p-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                        <item.icon className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <h3 className="mt-4 font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </section>
        ))}
      </div>

      <FadeUp className="mt-20 text-center">
        <Button size="xl" asChild>
          <Link href="/register">
            Start your free trial
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </FadeUp>
    </div>
  );
}
