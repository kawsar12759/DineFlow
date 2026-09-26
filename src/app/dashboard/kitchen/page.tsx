"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChefHat, CheckCheck, Flame, Timer } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TicketItem {
  _id: string;
  name: string;
  quantity: number;
  notes?: string;
  status: "queued" | "preparing" | "ready" | "served";
  sentAt: string;
}

interface Ticket {
  orderId: string;
  orderNumber: number;
  guests?: number;
  tables: string[];
  openedAt: string;
  items: TicketItem[];
}

interface BranchOption {
  _id: string;
  name: string;
}

/** Whole minutes since a dish was sent, for the "waiting" badge. */
function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

const NEXT_STATUS: Record<string, { label: string; value: TicketItem["status"] }> = {
  queued: { label: "Start", value: "preparing" },
  preparing: { label: "Ready", value: "ready" },
  ready: { label: "Served", value: "served" },
};

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState("");

  const { data: branchData } = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => api.get<BranchOption[]>("/api/branches?limit=100"),
  });
  const branches = branchData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["kitchen", branchId],
    queryFn: () =>
      api.get<{ branch: BranchOption; tickets: Ticket[] }>(
        `/api/kitchen${branchId ? `?branchId=${branchId}` : ""}`
      ),
    // The kitchen screen is left open all service, so keep it fresh.
    refetchInterval: 15_000,
  });

  const advance = useMutation({
    mutationFn: ({
      orderId,
      itemId,
      status,
    }: {
      orderId: string;
      itemId: string;
      status: TicketItem["status"];
    }) => api.patch(`/api/orders/${orderId}/items/${itemId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["kitchen"] }),
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not update"
      ),
  });

  const tickets = data?.data.tickets ?? [];
  const waiting = tickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((i) => i.status !== "ready").length,
    0
  );
  const ready = tickets.reduce(
    (sum, ticket) => sum + ticket.items.filter((i) => i.status === "ready").length,
    0
  );

  return (
    <>
      <PageHeader
        title="Kitchen"
        description="Dishes sent from the floor, oldest first."
      >
        {branches.length > 1 && (
          <Select
            value={branchId || data?.data.branch._id || ""}
            onValueChange={setBranchId}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Branch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      {!isLoading && tickets.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {tickets.length} {tickets.length === 1 ? "ticket" : "tickets"} ·{" "}
          {waiting} cooking · {ready} ready to serve
        </p>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 w-full" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={ChefHat}
          title="Nothing to cook right now"
          description="Dishes appear here the moment the floor sends an order."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tickets.map((ticket) => {
            const oldest = Math.max(
              ...ticket.items.map((item) => minutesSince(item.sentAt))
            );
            return (
              <Card
                key={ticket.orderId}
                className={cn(oldest >= 20 && "border-destructive")}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold">
                        #{ticket.orderNumber}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ticket.tables.join(", ") || "No table"}
                        {ticket.guests ? ` · ${ticket.guests} guests` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={oldest >= 20 ? "destructive" : "secondary"}
                      className="shrink-0"
                    >
                      <Timer className="mr-1 h-3 w-3" />
                      {oldest} min
                    </Badge>
                  </div>

                  <ul className="space-y-2">
                    {ticket.items.map((item) => {
                      const next = NEXT_STATUS[item.status];
                      return (
                        <li
                          key={item._id}
                          className={cn(
                            "rounded-lg border p-2",
                            item.status === "preparing" && "border-amber-300 bg-amber-50 dark:bg-amber-950/40",
                            item.status === "ready" && "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {item.quantity}× {item.name}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-muted-foreground">
                                  “{item.notes}”
                                </p>
                              )}
                            </div>
                            {next && (
                              <Button
                                size="sm"
                                variant={
                                  item.status === "ready" ? "outline" : "default"
                                }
                                onClick={() =>
                                  advance.mutate({
                                    orderId: ticket.orderId,
                                    itemId: item._id,
                                    status: next.value,
                                  })
                                }
                              >
                                {item.status === "queued" ? (
                                  <Flame className="h-3.5 w-3.5" />
                                ) : (
                                  <CheckCheck className="h-3.5 w-3.5" />
                                )}
                                {next.label}
                              </Button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
