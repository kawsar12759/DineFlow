"use client";

import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  ChefHat,
  Minus,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayDialog } from "@/components/dashboard/orders/pay-dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/lib/utils";
import { MENU_CATEGORIES } from "@/lib/constants";

interface OrderItem {
  _id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
  status: "queued" | "preparing" | "ready" | "served";
  voided: boolean;
  sentAt?: string;
}

interface OrderDetail {
  _id: string;
  orderNumber: number;
  status: "open" | "paid" | "void";
  guests?: number;
  items: OrderItem[];
  discountAmount: number;
  vatPercent: number;
  serviceChargePercent: number;
  subtotal: number;
  vatAmount: number;
  serviceChargeAmount: number;
  total: number;
  tableIds: { _id: string; name: string }[];
  customerId?: { _id: string; name: string } | null;
  branchId?: { _id: string; name: string };
  payment?: {
    method: string;
    amount: number;
    changeGiven?: number;
    paidAt: string;
  };
}

interface MenuItemOption {
  _id: string;
  name: string;
  price: number;
  category: string;
  availability: boolean;
}

const STATUS_LABEL: Record<OrderItem["status"], string> = {
  queued: "With the kitchen",
  preparing: "Cooking",
  ready: "Ready to serve",
  served: "Served",
};

/** A line is only "not sent" until it goes to the kitchen. */
function itemState(item: OrderItem) {
  if (item.voided) return "voided";
  if (!item.sentAt) return "Not sent yet";
  return STATUS_LABEL[item.status];
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [payOpen, setPayOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => api.get<OrderDetail>(`/api/orders/${id}`),
    refetchInterval: 30_000,
  });
  const order = data?.data;

  const { data: menuData } = useQuery({
    queryKey: ["menu-items", "order", debouncedSearch, category],
    queryFn: () =>
      api.get<MenuItemOption[]>(
        `/api/menu-items?limit=100&availability=true&search=${encodeURIComponent(debouncedSearch)}&category=${category}`
      ),
  });
  const menuItems = menuData?.data ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["order", id] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["kitchen"] });
  };

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof ApiClientError ? error.message : fallback);

  const addItem = useMutation({
    mutationFn: (menuItemId: string) =>
      api.post(`/api/orders/${id}`, { items: [{ menuItemId, quantity: 1 }] }),
    onSuccess: refresh,
    onError: (error) => fail(error, "Could not add the dish"),
  });

  const updateItem = useMutation({
    mutationFn: ({
      itemId,
      patch,
    }: {
      itemId: string;
      patch: Record<string, unknown>;
    }) => api.patch(`/api/orders/${id}/items/${itemId}`, patch),
    onSuccess: refresh,
    onError: (error) => fail(error, "Could not update the item"),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.delete(`/api/orders/${id}/items/${itemId}`),
    onSuccess: refresh,
    onError: (error) => fail(error, "Could not remove the item"),
  });

  const sendToKitchen = useMutation({
    mutationFn: () => api.patch(`/api/orders/${id}`, { sendToKitchen: true }),
    onSuccess: () => {
      toast.success("Sent to the kitchen");
      refresh();
    },
    onError: (error) => fail(error, "Could not send the order"),
  });

  const setDiscount = useMutation({
    mutationFn: (discountAmount: number) =>
      api.patch(`/api/orders/${id}`, { discountAmount }),
    onSuccess: refresh,
    onError: (error) => fail(error, "Could not apply the discount"),
  });

  const voidOrder = useMutation({
    mutationFn: () => api.delete(`/api/orders/${id}`),
    onSuccess: () => {
      toast.success("Order voided");
      router.push("/dashboard/orders");
    },
    onError: (error) => fail(error, "Could not void the order"),
  });

  const unsent = useMemo(
    () => (order?.items ?? []).filter((item) => !item.voided && !item.sentAt).length,
    [order]
  );

  if (isLoading || !order) {
    return (
      <>
        <PageHeader title="Order" description="Loading the ticket…" />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  const editable = order.status === "open";

  return (
    <>
      <PageHeader
        title={`Order #${order.orderNumber}`}
        description={[
          order.tableIds.map((table) => table.name).join(", ") || "No table",
          order.customerId?.name,
          order.guests ? `${order.guests} guests` : null,
          order.branchId?.name,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <Button variant="outline" asChild>
          <Link href="/dashboard/orders">
            <ArrowLeft className="h-4 w-4" />
            All orders
          </Link>
        </Button>
      </PageHeader>

      {!editable && (
        <p className="rounded-lg border bg-muted px-4 py-3 text-sm">
          This order is {order.status}
          {order.payment
            ? ` — ${formatCurrency(order.payment.amount)} by ${order.payment.method}${
                order.payment.changeGiven
                  ? `, ${formatCurrency(order.payment.changeGiven)} change given`
                  : ""
              }`
            : ""}
          .
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Menu picker */}
        {editable && (
          <Card className="order-2 lg:order-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add dishes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search the menu…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Tabs value={category} onValueChange={setCategory}>
                <TabsList className="flex-wrap">
                  <TabsTrigger value="all">All</TabsTrigger>
                  {MENU_CATEGORIES.map((item) => (
                    <TabsTrigger key={item} value={item}>
                      {item}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="grid gap-2 sm:grid-cols-2">
                {menuItems.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => addItem.mutate(item._id)}
                    className="flex items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:border-primary hover:text-primary"
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 font-medium">
                      {formatCurrency(item.price)}
                    </span>
                  </button>
                ))}
                {menuItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No dishes match that search.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* The bill */}
        <Card className="order-1 lg:order-2 lg:sticky lg:top-8 lg:self-start">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">The bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing ordered yet. Pick dishes from the menu.
              </p>
            ) : (
              <ul className="space-y-3">
                {order.items.map((item) => (
                  <li key={item._id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p
                          className={
                            item.voided
                              ? "text-sm line-through text-muted-foreground"
                              : "text-sm font-medium"
                          }
                        >
                          {item.quantity}× {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatCurrency(item.unitPrice)} each · {itemState(item)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-medium">
                        {formatCurrency(item.voided ? 0 : item.unitPrice * item.quantity)}
                      </span>
                    </div>

                    {editable && !item.voided && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Fewer ${item.name}`}
                          disabled={item.quantity <= 1}
                          onClick={() =>
                            updateItem.mutate({
                              itemId: item._id,
                              patch: { quantity: item.quantity - 1 },
                            })
                          }
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`More ${item.name}`}
                          onClick={() =>
                            updateItem.mutate({
                              itemId: item._id,
                              patch: { quantity: item.quantity + 1 },
                            })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {item.sentAt ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() =>
                              updateItem.mutate({
                                itemId: item._id,
                                patch: { voided: true },
                              })
                            }
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Void
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeItem.mutate(item._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <Separator />

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatCurrency(order.subtotal)}</dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <dt>Discount</dt>
                  <dd>−{formatCurrency(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">
                  Service charge ({order.serviceChargePercent}%)
                </dt>
                <dd>{formatCurrency(order.serviceChargeAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">VAT ({order.vatPercent}%)</dt>
                <dd>{formatCurrency(order.vatAmount)}</dd>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd>{formatCurrency(order.total)}</dd>
              </div>
            </dl>

            {editable && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount (৳)</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    defaultValue={order.discountAmount}
                    onBlur={(event) => {
                      const value = Number(event.target.value) || 0;
                      if (value !== order.discountAmount) setDiscount.mutate(value);
                    }}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={unsent === 0}
                    loading={sendToKitchen.isPending}
                    onClick={() => sendToKitchen.mutate()}
                  >
                    <ChefHat className="h-4 w-4" />
                    Send {unsent > 0 ? `${unsent} ` : ""}to kitchen
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={order.items.filter((i) => !i.voided).length === 0}
                    onClick={() => setPayOpen(true)}
                  >
                    Close bill · {formatCurrency(order.total)}
                  </Button>
                </div>

                <Button
                  variant="ghost"
                  className="w-full text-destructive"
                  loading={voidOrder.isPending}
                  onClick={() => voidOrder.mutate()}
                >
                  Void this order
                </Button>
              </>
            )}

            {order.status === "paid" && order.payment && (
              <Badge variant="secondary" className="w-full justify-center py-2">
                Paid {formatCurrency(order.payment.amount)} by {order.payment.method}
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      <PayDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        orderId={order._id}
        total={order.total}
        onPaid={() => {
          refresh();
          toast.success("Bill closed");
        }}
      />
    </>
  );
}
