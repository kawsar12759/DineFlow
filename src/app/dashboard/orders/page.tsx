"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, ReceiptText, Users } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import { todayKey } from "@/lib/dates";

interface OrderSummary {
  _id: string;
  orderNumber: number;
  status: "open" | "paid" | "void";
  guests?: number;
  total: number;
  subtotal: number;
  items: { quantity: number; voided: boolean; status: string }[];
  tableIds: { _id: string; name: string }[];
  customerId?: { _id: string; name: string } | null;
  branchId?: { _id: string; name: string };
  createdAt: string;
  payment?: { method: string };
}

interface BranchOption {
  _id: string;
  name: string;
}

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("open");
  const [branchId, setBranchId] = useState("all");

  const { data: branchData } = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => api.get<BranchOption[]>("/api/branches?limit=100"),
  });
  const branches = branchData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["orders", status, branchId],
    queryFn: () =>
      api.get<OrderSummary[]>(
        `/api/orders?status=${status}&branchId=${branchId}${status === "paid" ? `&date=${todayKey()}` : ""}`
      ),
    refetchInterval: 60_000,
  });
  const orders = data?.data ?? [];

  const open = useMutation({
    mutationFn: (branch: string) =>
      api.post<{ _id: string }>("/api/orders", { branchId: branch }),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push(`/dashboard/orders/${response.data._id}`);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not open an order"
      ),
  });

  const targetBranch = branchId !== "all" ? branchId : branches[0]?._id;

  return (
    <>
      <PageHeader
        title="Orders"
        description="Open tickets and today's closed bills."
      >
        <Button
          disabled={!targetBranch || open.isPending}
          loading={open.isPending}
          onClick={() => targetBranch && open.mutate(targetBranch)}
        >
          <Plus className="h-4 w-4" />
          New order
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="paid">Paid today</TabsTrigger>
            <TabsTrigger value="void">Voided</TabsTrigger>
          </TabsList>
        </Tabs>

        {branches.length > 1 && (
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Branch">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={status === "open" ? "No open orders" : "Nothing here"}
          description={
            status === "open"
              ? "Open a ticket from the floor when a party is seated, or start one here."
              : "Closed and voided bills from today appear here."
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => {
            const dishes = order.items
              .filter((item) => !item.voided)
              .reduce((sum, item) => sum + item.quantity, 0);
            const waiting = order.items.some(
              (item) => !item.voided && item.status !== "served"
            );

            return (
              <Link key={order._id} href={`/dashboard/orders/${order._id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-lg font-semibold">
                          #{order.orderNumber}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {order.tableIds.map((table) => table.name).join(", ") ||
                            "No table"}
                          {order.branchId ? ` · ${order.branchId.name}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant={order.status === "open" ? "default" : "secondary"}
                      >
                        {order.status === "paid"
                          ? order.payment?.method ?? "paid"
                          : order.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {order.customerId?.name ??
                          (order.guests ? `${order.guests} guests` : "Walk-in")}
                      </span>
                      <span className="font-medium">
                        {formatCurrency(order.total || order.subtotal)}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {dishes} {dishes === 1 ? "dish" : "dishes"}
                      {order.status === "open" &&
                        (waiting ? " · kitchen working" : " · all served")}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
