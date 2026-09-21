import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  ChefHat,
  Globe2,
  LayoutDashboard,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FadeUp, Stagger, StaggerItem } from "@/components/marketing/animated";

const features = [
  {
    icon: CalendarCheck,
    title: "Smart reservations",
    description:
      "Capacity-aware booking with approval workflows, status tracking, and no-show protection.",
  },
  {
    icon: Store,
    title: "Multi-branch management",
    description:
      "Run every location from one dashboard — capacity, hours, contact info, and performance.",
  },
  {
    icon: ChefHat,
    title: "Menu engineering",
    description:
      "Categories, allergens, prep times, and availability toggles synced across branches in real time.",
  },
  {
    icon: Users,
    title: "Customer CRM",
    description:
      "Visit history, spend behavior, and tags that turn first-timers into regulars.",
  },
  {
    icon: BarChart3,
    title: "Revenue analytics",
    description:
      "Aggregated trends for revenue, covers, occupancy, and menu popularity — updated live.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    description:
      "Owners, managers, and staff each see exactly what they need. Nothing more.",
  },
];

const stats = [
  { value: "2,400+", label: "Restaurants onboard" },
  { value: "18M", label: "Covers booked" },
  { value: "32%", label: "Fewer no-shows" },
  { value: "99.95%", label: "Uptime SLA" },
];

const testimonials = [
  {
    quote:
      "DineFlow replaced four separate tools the day we switched. Reservations, menus, staff — one login, every branch.",
    name: "Amelia Rhodes",
    role: "Owner, Ember & Oak (6 locations)",
  },
  {
    quote:
      "The occupancy analytics alone paid for the subscription. We re-staffed our slow nights and margins jumped 11%.",
    name: "Marcus Chen",
    role: "Operations Director, Bao House Group",
  },
  {
    quote:
      "Our hosts approve bookings from the floor in two taps. Guests get instant confirmations. It just works.",
    name: "Sofia Martínez",
    role: "GM, La Talavera",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(161_84%_24%/0.08),transparent_60%)]"
          aria-hidden
        />
        <div className="container flex flex-col items-center py-24 text-center md:py-32">
          <FadeUp>
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Now with branch-level analytics
            </span>
          </FadeUp>
          <FadeUp delay={0.08}>
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              Run every table, branch, and shift from one platform
            </h1>
          </FadeUp>
          <FadeUp delay={0.16}>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
              DineFlow unifies reservations, menus, customers, staff, and
              analytics for multi-location restaurants — so you can focus on
              the food, not the spreadsheets.
            </p>
          </FadeUp>
          <FadeUp delay={0.24} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="xl" asChild>
              <Link href="/register">
                Start free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button size="xl" variant="outline" asChild>
              <Link href="/reserve">Book a table</Link>
            </Button>
          </FadeUp>

          {/* Dashboard preview mock */}
          <FadeUp delay={0.34} className="mt-16 w-full max-w-4xl">
            <div className="rounded-xl border bg-card p-2 shadow-2xl shadow-primary/5">
              <div className="rounded-lg border bg-muted/30">
                <div className="flex items-center gap-1.5 border-b px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-3 text-xs text-muted-foreground">
                    dineflow.app/dashboard
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                  {[
                    { label: "Today's reservations", value: "47", icon: CalendarCheck },
                    { label: "Occupancy", value: "82%", icon: LayoutDashboard },
                    { label: "Revenue (MTD)", value: "৳12.8L", icon: BarChart3 },
                    { label: "Active guests", value: "1,940", icon: Users },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border bg-background p-4 text-left"
                    >
                      <stat.icon className="h-4 w-4 text-primary" />
                      <div className="mt-2 text-xl font-semibold">{stat.value}</div>
                      <div className="text-xs text-muted-foreground">{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-4">
                  <div className="flex h-32 items-end gap-1.5 rounded-lg border bg-background p-4">
                    {[35, 48, 42, 60, 55, 72, 64, 80, 70, 88, 78, 95].map(
                      (height, index) => (
                        <div
                          key={index}
                          className="flex-1 rounded-t bg-primary/80"
                          style={{ height: `${height}%` }}
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y bg-muted/40">
        <div className="container grid grid-cols-2 gap-8 py-12 md:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="container py-24">
        <FadeUp className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your restaurant runs on
          </h2>
          <p className="mt-4 text-muted-foreground">
            Purpose-built modules that work together — not bolted-on
            integrations.
          </p>
        </FadeUp>
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <StaggerItem key={feature.title}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                    <feature.icon className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
        <FadeUp className="mt-10 text-center">
          <Button variant="outline" asChild>
            <Link href="/features">
              Explore all features
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </FadeUp>
      </section>

      {/* Testimonials */}
      <section className="border-y bg-muted/40 py-24">
        <div className="container">
          <FadeUp className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Loved by operators worldwide
            </h2>
            <p className="mt-4 text-muted-foreground">
              From single bistros to 50-branch groups.
            </p>
          </FadeUp>
          <Stagger className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((testimonial) => (
              <StaggerItem key={testimonial.name}>
                <Card className="h-full">
                  <CardContent className="flex h-full flex-col p-6">
                    <Globe2 className="h-5 w-5 text-primary" />
                    <blockquote className="mt-4 flex-1 text-sm leading-relaxed">
                      “{testimonial.quote}”
                    </blockquote>
                    <footer className="mt-6">
                      <div className="text-sm font-semibold">{testimonial.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.role}
                      </div>
                    </footer>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* CTA */}
      <section className="container py-24">
        <FadeUp>
          <div className="relative overflow-hidden rounded-2xl bg-sidebar px-8 py-16 text-center md:px-16">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(160_70%_42%/0.25),transparent_55%)]"
              aria-hidden
            />
            <h2 className="relative text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Ready to modernize your restaurant?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-balance text-sidebar-foreground">
              Set up your first branch in under five minutes. No credit card
              required for the 14-day trial.
            </p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="xl" asChild>
                <Link href="/register">
                  Get started free
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                asChild
              >
                <Link href="/pricing">View pricing</Link>
              </Button>
            </div>
          </div>
        </FadeUp>
      </section>
    </>
  );
}
