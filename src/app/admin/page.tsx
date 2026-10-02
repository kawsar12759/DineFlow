"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Banknote,
  Search,
  ShieldAlert,
  Store,
  TrendingUp,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useDebounce } from "@/hooks/use-debounce";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { SubscriptionPlan } from "@/lib/constants";
import type { SubscriptionStatus } from "@/lib/subscription";

interface RestaurantRow {
  _id: string;
  name: string;
  slug: string;
  owner: { name: string; email: string } | null;
  createdAt: string;
  branches: number;
  subscription: {
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    onTrial: boolean;
    endsAt: string;
    cutoffAt: string;
    daysLeft: number;
    suspendedReason?: string;
  };
  lastPayment: { paidAt: string; amount: number; period: string } | null;
}

interface Overview {
  summary: {
    restaurants: number;
    trial: number;
    active: number;
    grace: number;
    expired: number;
    suspended: number;
    mrr: number;
    revenue30d: number;
    paymentsInReview: number;
  };
  restaurants: RestaurantRow[];
}

interface PaymentRow {
  _id: string;
  restaurantId: { _id: string; name: string } | null;
  plan: SubscriptionPlan;
  period: string;
  amount: number;
  status: string;
  tranId: string;
  invoiceNumber?: string;
  createdAt: string;
  paidAt?: string;
  failureReason?: string;
  gatewayDetails?: { riskTitle?: string; cardType?: string };
}

const STATUS_STYLE: Record<SubscriptionStatus, string> = {
  trial: "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
  active: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  grace: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  expired: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60",
  suspended: "bg-red-100 text-red-800 dark:text-red-300 border-red-300",
};

const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  starter: "Starter",
  growth: "Growth",
  enterprise: "Enterprise",
};

function fail(error: unknown, fallback: string) {
  toast.error(error instanceof ApiClientError ? error.message : fallback);
}

export default function AdminPage() {
  const [tab, setTab] = useState("restaurants");

  const { data } = useQuery({
    queryKey: ["admin", "restaurants", "", "all"],
    queryFn: () => api.get<Overview>("/api/admin/restaurants"),
  });
  const summary = data?.data.summary;

  return (
    <>
      <PageHeader
        title="DineFlow admin"
        description="Every restaurant on DineFlow, their subscriptions and payments."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!summary ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              title="Restaurants"
              value={summary.restaurants}
              icon={Store}
              hint={`${summary.active} paying · ${summary.trial} on trial`}
            />
            <StatCard
              title="Monthly recurring revenue"
              value={formatCurrency(summary.mrr)}
              icon={TrendingUp}
              hint="Paying restaurants at their plan's monthly rate"
            />
            <StatCard
              title="Collected, last 30 days"
              value={formatCurrency(summary.revenue30d)}
              icon={Banknote}
            />
            <StatCard
              title="Needs attention"
              value={summary.grace + summary.expired + summary.paymentsInReview}
              icon={AlertTriangle}
              hint={`${summary.grace} overdue · ${summary.expired} paused · ${summary.paymentsInReview} ${summary.paymentsInReview === 1 ? "payment" : "payments"} to check`}
            />
          </>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
          <TabsTrigger value="payments">
            Payments
            {summary && summary.paymentsInReview > 0 && (
              <Badge className="ml-2 h-5 px-1.5">{summary.paymentsInReview}</Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "restaurants" ? <RestaurantsTab /> : <PaymentsTab />}
    </>
  );
}

function RestaurantsTab() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [managing, setManaging] = useState<RestaurantRow | null>(null);
  const debounced = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "restaurants", debounced, status],
    queryFn: () =>
      api.get<Overview>(
        `/api/admin/restaurants?search=${encodeURIComponent(debounced)}&status=${status}`
      ),
  });
  const rows = data?.data.restaurants ?? [];

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search restaurants…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            <SelectItem value="trial">On trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="grace">Overdue</SelectItem>
            <SelectItem value="expired">Paused</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-4 h-40" />
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No restaurants match.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Runs until</TableHead>
                  <TableHead>Last payment</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row._id}>
                    <TableCell>
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.owner?.email ?? "no owner"} · {row.branches}{" "}
                        {row.branches === 1 ? "branch" : "branches"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {PLAN_NAMES[row.subscription.plan]}
                      {row.subscription.onTrial && (
                        <span className="text-xs text-muted-foreground"> (trial)</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLE[row.subscription.status]}>
                        {row.subscription.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(row.subscription.endsAt)}
                      <p className="text-xs text-muted-foreground">
                        {row.subscription.daysLeft >= 0
                          ? `${row.subscription.daysLeft} days left`
                          : `${-row.subscription.daysLeft} days ago`}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.lastPayment ? (
                        <>
                          {formatCurrency(row.lastPayment.amount)}
                          <p className="text-xs text-muted-foreground">
                            {formatDate(row.lastPayment.paidAt)} · {row.lastPayment.period}
                          </p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Never paid</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setManaging(row)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ManageDialog restaurant={managing} onClose={() => setManaging(null)} />
    </>
  );
}

function ManageDialog({
  restaurant,
  onClose,
}: {
  restaurant: RestaurantRow | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [extendDays, setExtendDays] = useState("");
  const [plan, setPlan] = useState<SubscriptionPlan | "">("");
  const [suspended, setSuspended] = useState<boolean | null>(null);
  const [note, setNote] = useState("");

  const reset = () => {
    setExtendDays("");
    setPlan("");
    setSuspended(null);
    setNote("");
  };

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/api/admin/restaurants/${restaurant!._id}`, {
        extendDays: extendDays ? Number(extendDays) : undefined,
        plan: plan || undefined,
        suspended: suspended ?? undefined,
        note,
      }),
    onSuccess: () => {
      toast.success(`${restaurant!.name} updated`);
      queryClient.invalidateQueries({ queryKey: ["admin"] });
      reset();
      onClose();
    },
    onError: (error) => fail(error, "Could not update the restaurant"),
  });

  if (!restaurant) return null;
  const isSuspended = suspended ?? restaurant.subscription.status === "suspended";

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{restaurant.name}</DialogTitle>
          <DialogDescription>
            {PLAN_NAMES[restaurant.subscription.plan]} · {restaurant.subscription.status} · runs
            until {formatDate(restaurant.subscription.endsAt)}. Changes are recorded in the
            restaurant&apos;s own activity log.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="extend">Add free days</Label>
              <Input
                id="extend"
                type="number"
                min={1}
                max={365}
                placeholder="e.g. 14"
                value={extendDays}
                onChange={(event) => setExtendDays(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Plan</Label>
              <Select
                value={plan || restaurant.subscription.plan}
                onValueChange={(value) => setPlan(value as SubscriptionPlan)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-3",
              isSuspended && "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
            )}
          >
            <div>
              <Label htmlFor="suspended">
                <ShieldAlert className="mr-1 inline h-4 w-4" />
                Suspended
              </Label>
              <p className="text-xs text-muted-foreground">
                Read-only dashboard and no online booking, whatever they have paid.
              </p>
            </div>
            <Switch id="suspended" checked={isSuspended} onCheckedChange={setSuspended} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Reason (shown to the restaurant)</Label>
            <Textarea
              id="note"
              rows={2}
              required
              minLength={3}
              maxLength={300}
              placeholder="e.g. Goodwill: payment page was down on 12 Oct"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsTab() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payments", status, page],
    queryFn: () => api.get<PaymentRow[]>(`/api/admin/payments?status=${status}&page=${page}&limit=20`),
  });
  const payments = data?.data ?? [];

  const decide = useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note: string }) =>
      api.patch(`/api/admin/payments/${id}`, { decision, note }),
    onSuccess: () => {
      toast.success("Payment decided");
      queryClient.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (error) => fail(error, "Could not decide the payment"),
  });

  return (
    <>
      <Select
        value={status}
        onValueChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any status</SelectItem>
          <SelectItem value="paid">Paid</SelectItem>
          <SelectItem value="review">Waiting for review</SelectItem>
          <SelectItem value="pending">In progress</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="m-4 h-40" />
          ) : payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.paidAt ?? payment.createdAt)}
                    </TableCell>
                    <TableCell>{payment.restaurantId?.name ?? "Deleted"}</TableCell>
                    <TableCell className="capitalize">
                      {payment.plan} · {payment.period}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>
                      {payment.status === "review" ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                            review
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={decide.isPending}
                            onClick={() => {
                              const note = window.prompt("Why is this payment genuine?");
                              if (note) decide.mutate({ id: payment._id, decision: "approve", note });
                            }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={decide.isPending}
                            onClick={() => {
                              const note = window.prompt("Why reject it?");
                              if (note) decide.mutate({ id: payment._id, decision: "reject", note });
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" title={payment.failureReason}>
                          {payment.status}
                        </Badge>
                      )}
                      {payment.gatewayDetails?.riskTitle && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {payment.gatewayDetails.riskTitle}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {payment.invoiceNumber ?? payment.tranId}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data?.pagination && data.pagination.totalPages > 1 && (
        <PaginationControls
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
