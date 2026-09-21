import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FadeUp, Stagger, StaggerItem } from "@/components/marketing/animated";
import { cn, formatCurrency } from "@/lib/utils";
import { PLAN_MONTHLY_PRICE } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for restaurants of every size.",
};

const plans = [
  {
    name: "Starter",
    price: formatCurrency(PLAN_MONTHLY_PRICE.starter!),
    period: "/month",
    description: "For single-location restaurants getting organized.",
    highlighted: false,
    cta: "Start free trial",
    features: [
      "1 branch",
      "Unlimited reservations",
      "Menu management",
      "Customer profiles",
      "Basic analytics (30 days)",
      "2 staff accounts",
      "Email support",
    ],
  },
  {
    name: "Growth",
    price: formatCurrency(PLAN_MONTHLY_PRICE.growth!),
    period: "/month",
    description: "For growing groups that need full visibility.",
    highlighted: true,
    cta: "Start free trial",
    features: [
      "Up to 10 branches",
      "Everything in Starter",
      "Advanced analytics (12 months)",
      "Branch performance comparison",
      "Unlimited staff accounts",
      "Role-based access control",
      "Priority support",
      "Public booking page",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For chains and franchises with complex needs.",
    highlighted: false,
    cta: "Contact sales",
    features: [
      "Unlimited branches",
      "Everything in Growth",
      "Dedicated success manager",
      "Custom integrations & API",
      "SSO / SAML",
      "99.95% uptime SLA",
      "Onboarding & migration",
    ],
  },
];

const faqs = [
  {
    question: "Is there a free trial?",
    answer:
      "Yes — every plan starts with a 14-day free trial. No credit card required.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Anytime. Upgrades take effect immediately; downgrades apply at the next billing cycle.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "You can export everything (reservations, customers, menus) as CSV. We retain data for 90 days after cancellation, then permanently delete it.",
  },
  {
    question: "Do you charge per reservation?",
    answer:
      "No. Unlike legacy booking platforms, DineFlow never charges per-cover fees. Flat monthly pricing, unlimited bookings.",
  },
];

export default function PricingPage() {
  return (
    <div className="container py-20">
      <FadeUp className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Pricing that scales with you
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Flat monthly pricing. Unlimited reservations. No per-cover fees, ever.
        </p>
      </FadeUp>

      <Stagger className="mt-16 grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <StaggerItem key={plan.name}>
            <Card
              className={cn(
                "relative h-full",
                plan.highlighted &&
                  "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary"
              )}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most popular
                </Badge>
              )}
              <CardContent className="flex h-full flex-col p-8">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-8 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  size="lg"
                  asChild
                >
                  <Link href={plan.name === "Enterprise" ? "/contact" : "/register"}>
                    {plan.cta}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      <section className="mx-auto mt-24 max-w-3xl">
        <FadeUp>
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Frequently asked questions
          </h2>
        </FadeUp>
        <div className="mt-8 space-y-4">
          {faqs.map((faq) => (
            <FadeUp key={faq.question}>
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-medium">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </p>
                </CardContent>
              </Card>
            </FadeUp>
          ))}
        </div>
      </section>
    </div>
  );
}
