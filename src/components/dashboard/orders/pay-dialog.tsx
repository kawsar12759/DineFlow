"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
import { cn, formatCurrency } from "@/lib/utils";

type Method = "cash" | "card" | "bkash" | "nagad" | "rocket" | "other";

const METHODS: { value: Method; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "card", label: "Card", icon: CreditCard },
  { value: "bkash", label: "bKash", icon: Smartphone },
  { value: "nagad", label: "Nagad", icon: Smartphone },
  { value: "rocket", label: "Rocket", icon: Smartphone },
  { value: "other", label: "Other", icon: Wallet },
];

export function PayDialog({
  open,
  onOpenChange,
  orderId,
  total,
  onPaid,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  total: number;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<Method>("cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");

  useEffect(() => {
    if (open) {
      setMethod("cash");
      setTendered("");
      setReference("");
    }
  }, [open]);

  const pay = useMutation({
    mutationFn: () =>
      api.post(`/api/orders/${orderId}/pay`, {
        method,
        amount: tendered ? Number(tendered) : undefined,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      onPaid();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not close the bill"
      ),
  });

  const amount = Number(tendered) || 0;
  const change = amount > total ? amount - total : 0;
  const mobileMoney = ["bkash", "nagad", "rocket"].includes(method);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close the bill</DialogTitle>
          <DialogDescription>
            Total due {formatCurrency(total)}. This records the payment and
            completes the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setMethod(item.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors hover:border-primary",
                      method === item.value &&
                        "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tendered">
              {method === "cash" ? "Cash received (optional)" : "Amount (optional)"}
            </Label>
            <Input
              id="tendered"
              type="number"
              min={0}
              placeholder={String(total)}
              value={tendered}
              onChange={(event) => setTendered(event.target.value)}
            />
            {change > 0 && (
              <p className="text-sm text-muted-foreground">
                Change to give back:{" "}
                <span className="font-medium text-foreground">
                  {formatCurrency(change)}
                </span>
              </p>
            )}
          </div>

          {mobileMoney && (
            <div className="space-y-1.5">
              <Label htmlFor="reference">Transaction ID (optional)</Label>
              <Input
                id="reference"
                placeholder="e.g. 8N7A2K9QX1"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={pay.isPending} onClick={() => pay.mutate()}>
            Take {formatCurrency(total)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
