"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Minus, Plus } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import type { LoyaltySettings } from "@/lib/constants";

export interface LoyaltyEntry {
  _id: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
  actorId?: { name: string } | null;
}

const TYPE_LABEL: Record<LoyaltyEntry["type"], string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjusted",
};

export function LoyaltyCard({
  customerId,
  customerName,
  points,
  history,
  settings,
  canAdjust,
}: {
  customerId: string;
  customerName: string;
  points: number;
  history: LoyaltyEntry[];
  settings: LoyaltySettings;
  canAdjust: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const adjust = useMutation({
    mutationFn: () =>
      api.post(`/api/customers/${customerId}/loyalty`, {
        points: direction * Math.round(Number(amount)),
        note,
      }),
    onSuccess: () => {
      toast.success("Points balance updated");
      queryClient.invalidateQueries({ queryKey: ["customer", customerId] });
      setOpen(false);
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : "Could not update points"),
  });

  const openDialog = (sign: 1 | -1) => {
    setDirection(sign);
    setAmount("");
    setNote("");
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            Loyalty points
          </CardTitle>
          <CardDescription>
            {settings.enabled
              ? `Worth ${formatCurrency(points * settings.pointValueTaka)} · redeemable from ${settings.minRedeemPoints} points`
              : "The loyalty programme is off in Settings; balances are kept."}
          </CardDescription>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold">{points.toLocaleString("en-IN")}</div>
          <div className="text-xs text-muted-foreground">points</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {canAdjust && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => openDialog(1)}>
              <Plus className="h-3.5 w-3.5" />
              Add points
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={points === 0}
              onClick={() => openDialog(-1)}
            >
              <Minus className="h-3.5 w-3.5" />
              Remove points
            </Button>
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No points earned yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {history.map((entry) => (
              <li key={entry._id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {TYPE_LABEL[entry.type]}
                    </Badge>
                    <span className="truncate">{entry.note}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                    {entry.actorId?.name ? ` · ${entry.actorId.name}` : ""} · balance{" "}
                    {entry.balanceAfter.toLocaleString("en-IN")}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 font-medium",
                    entry.points > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  )}
                >
                  {entry.points > 0 ? "+" : ""}
                  {entry.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {direction > 0 ? "Add points for" : "Remove points from"} {customerName}
            </DialogTitle>
            <DialogDescription>
              The change and your reason are kept in the guest&apos;s points
              history and the activity log.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              adjust.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="adjust-points">Points</Label>
              <Input
                id="adjust-points"
                type="number"
                min={1}
                max={direction < 0 ? points : 100000}
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-note">Reason</Label>
              <Input
                id="adjust-note"
                required
                minLength={2}
                maxLength={200}
                placeholder={direction > 0 ? "Sorry for the long wait on Friday" : "Points added by mistake"}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={adjust.isPending}>
                {direction > 0 ? "Add" : "Remove"} points
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
