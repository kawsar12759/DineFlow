"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, CreditCard, FileText, FlaskConical } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { BillingPeriod, SubscriptionPlan } from "@/lib/constants";
import type { SubscriptionState } from "@/lib/subscription";

interface PlanOption {
  id: SubscriptionPlan;
  name: string;
  maxBranches: number | null;
  maxStaff: number | null;
  analyticsDays: number;
  loyalty: boolean;
  selfServe: boolean;
  monthly: number | null;
  yearly: number | null;
}

interface Payment {
  _id: string;
  plan: SubscriptionPlan;
  period: BillingPeriod;
  amount: number;
  status: "paid" | "failed" | "cancelled" | "review";
  invoiceNumber?: string;
  periodEnd?: string;
  paidAt?: string;
  createdAt: string;
  failureReason?: string;
}

interface Billing {
  subscription: Omit<SubscriptionState, "endsAt" | "cutoffAt"> & {
    endsAt: string;
    cutoffAt: string;
  };
  usage: { branches: number; staff: number };
  plans: PlanOption[];
  payments: Payment[];
  paymentsEnabled: boolean;
  sandbox: boolean;
}

const STATUS_BADGE: Record<SubscriptionState["status"], { label: string; className: string }> = {
  trial: { label: "Free trial", className: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60" },
  active: { label: "Active", className: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60" },
  grace: { label: "Payment due", className: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60" },
  expired: { label: "Paused", className: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60" },
  suspended: { label: "Suspended", className: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60" },
};

const PAYMENT_MESSAGES: Record<string, { kind: "success" | "error" | "info"; text: string }> = {
  paid: { kind: "success", text: "Payment received — thank you! Your receipt is on its way by email." },
  review: {
    kind: "info",
    text: "Your payment went through but SSLCommerz asked us to check it. We will confirm within one working day.",
  },
  failed: { kind: "error", text: "The payment did not go through. No money was taken — please try again." },
  cancelled: { kind: "info", text: "Payment cancelled. Nothing was charged." },
  unknown: {
    kind: "info",
    text: "We could not confirm the payment yet. If money was taken, it will show here within a few minutes.",
  },
};

function limitText(value: number | null, noun: string, plural = `${noun}s`) {
  if (value === null) return `Unlimited ${plural}`;
  return `${value} ${value === 1 ? noun : plural}`;
}

function usageText(used: number, limit: number | null) {
  return limit === null ? `${used} in use` : `${used} of ${limit}`;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["billing"],
    queryFn: () => api.get<Billing>("/api/billing"),
  });
  const billing = data?.data;

  // Coming back from SSLCommerz: say what happened, once.
  const result = searchParams.get("payment");
  useEffect(() => {
    if (!result) return;
    const message = PAYMENT_MESSAGES[result] ?? PAYMENT_MESSAGES.unknown;
    if (message.kind === "success") toast.success(message.text, { duration: 8000 });
    else if (message.kind === "error") toast.error(message.text, { duration: 8000 });
    else toast.info(message.text, { duration: 8000 });
    refetch();
    router.replace("/dashboard/billing");
  }, [result, refetch, router]);

  const checkout = useMutation({
    mutationFn: (plan: SubscriptionPlan) =>
      api.post<{ url: string }>("/api/billing/checkout", { plan, period }),
    onSuccess: (response) => window.location.assign(response.data.url),
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : "Could not start the payment"),
  });

  if (isLoading || !billing) {
    return (
      <>
        <PageHeader title="Billing" description="Your plan and payments." />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </>
    );
  }

  const { subscription: sub, usage } = billing;
  const current = billing.plans.find((plan) => plan.id === sub.plan)!;
  const badge = STATUS_BADGE[sub.status];

  return (
    <>
      <PageHeader title="Billing" description="Your plan, what it includes, and your payments." />

      {/* Current plan */}
      <Card>
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{current.name}</h2>
              <Badge variant="outline" className={badge.className}>
                {badge.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {sub.status === "trial" && `Free trial until ${formatDate(sub.endsAt)}.`}
              {sub.status === "active" && `Paid until ${formatDate(sub.endsAt)}.`}
              {sub.status === "grace" &&
                `Ended ${formatDate(sub.endsAt)}. Keeps working until ${formatDate(sub.cutoffAt)}.`}
              {sub.status === "expired" && "Paused: renew to make changes and take online bookings again."}
              {sub.status === "suspended" && "Suspended by DineFlow. Please contact support."}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm md:text-right">
            <dt className="text-muted-foreground">Branches</dt>
            <dd className="font-medium">{usageText(usage.branches, current.maxBranches)}</dd>
            <dt className="text-muted-foreground">Staff accounts</dt>
            <dd className="font-medium">{usageText(usage.staff, current.maxStaff)}</dd>
          </dl>
        </CardContent>
      </Card>

      {!billing.paymentsEnabled ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Online payment is not set up on this server yet. Please contact DineFlow to renew.
        </p>
      ) : (
        billing.sandbox && (
          <p className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <FlaskConical className="h-4 w-4 shrink-0" />
            Test mode: payments go through the SSLCommerz sandbox and no real money is taken.
          </p>
        )
      )}

      {/* Plans */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {sub.onTrial || sub.status === "expired" ? "Choose a plan" : "Renew or change plan"}
        </h2>
        <Tabs value={period} onValueChange={(value) => setPeriod(value as BillingPeriod)}>
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly · 2 months free</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {billing.plans.map((plan) => {
          const price = period === "yearly" ? plan.yearly : plan.monthly;
          const isCurrent = plan.id === sub.plan;
          const tooSmall =
            (plan.maxBranches !== null && usage.branches > plan.maxBranches) ||
            (plan.maxStaff !== null && usage.staff > plan.maxStaff);

          return (
            <Card key={plan.id} className={cn(isCurrent && "border-primary")}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isCurrent && <Badge variant="secondary">Current</Badge>}
                </CardTitle>
                <CardDescription>
                  {price === null ? (
                    "Custom pricing"
                  ) : (
                    <>
                      <span className="text-2xl font-semibold text-foreground">
                        {formatCurrency(price)}
                      </span>{" "}
                      / {period === "yearly" ? "year" : "month"}
                    </>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5 text-sm">
                  {[
                    limitText(plan.maxBranches, "branch", "branches"),
                    limitText(plan.maxStaff, "staff account"),
                    `Analytics: last ${plan.analyticsDays} days`,
                    plan.loyalty ? "Loyalty points" : null,
                  ]
                    .filter(Boolean)
                    .map((line) => (
                      <li key={line} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                        {line}
                      </li>
                    ))}
                </ul>

                {plan.selfServe ? (
                  <>
                    <Button
                      className="w-full"
                      variant={isCurrent ? "default" : "outline"}
                      disabled={!billing.paymentsEnabled || sub.status === "suspended" || tooSmall}
                      loading={checkout.isPending && checkout.variables === plan.id}
                      onClick={() => checkout.mutate(plan.id)}
                    >
                      <CreditCard className="h-4 w-4" />
                      {isCurrent && !sub.onTrial ? "Renew" : `Pay for ${plan.name}`}
                    </Button>
                    {tooSmall && (
                      <p className="text-xs text-muted-foreground">
                        You are using more branches or staff than {plan.name} allows.
                      </p>
                    )}
                  </>
                ) : (
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/contact">Contact sales</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Paying for your current plan adds the time after what you have left, so
        renewing early loses nothing. Switching plan starts the new one now, and
        paid days left on the old plan carry over at their value. Pay with bKash,
        Nagad, Rocket, cards or internet banking through SSLCommerz.
      </p>

      {/* Payments */}
      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Invoices for every payment, and attempts that did not go through.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {billing.payments.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">No payments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {billing.payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell>{formatDate(payment.paidAt ?? payment.createdAt)}</TableCell>
                    <TableCell className="capitalize">
                      {payment.plan} · {payment.period}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          payment.status === "paid" && "border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300",
                          payment.status === "review" && "border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300"
                        )}
                        title={payment.failureReason}
                      >
                        {payment.status === "review" ? "Being checked" : payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {payment.invoiceNumber ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/billing/invoices/${payment._id}`}>
                            <FileText className="h-3.5 w-3.5" />
                            {payment.invoiceNumber}
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
