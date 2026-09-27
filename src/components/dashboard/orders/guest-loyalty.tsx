"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Search, UserPlus, X } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency } from "@/lib/utils";
import type { LoyaltySettings } from "@/lib/constants";

interface Guest {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints?: number;
}

/**
 * The guest on a bill and their points: attach someone to a table order so
 * they earn, and spend their balance as a discount.
 */
export function GuestLoyalty({
  orderId,
  guest,
  fromBooking,
  editable,
  loyalty,
  pointsRedeemed,
  payable,
  onChanged,
}: {
  orderId: string;
  guest: Guest | null;
  /** A booking's order always belongs to whoever booked. */
  fromBooking: boolean;
  editable: boolean;
  loyalty?: LoyaltySettings;
  pointsRedeemed: number;
  /** Subtotal after the manual discount — the most points can cover. */
  payable: number;
  onChanged: () => void;
}) {
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [redeem, setRedeem] = useState("");
  const debounced = useDebounce(search, 300);

  const { data: results } = useQuery({
    queryKey: ["customers", "attach", debounced],
    queryFn: () =>
      api.get<Guest[]>(
        `/api/customers?limit=6&search=${encodeURIComponent(debounced)}`
      ),
    enabled: searching && debounced.trim().length >= 2,
  });

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/orders/${orderId}`, body),
    onSuccess: () => {
      setSearching(false);
      setSearch("");
      setRedeem("");
      onChanged();
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : "Could not update the bill"),
  });

  const balance = guest?.loyaltyPoints ?? 0;
  const enabled = !!loyalty?.enabled;
  const maxByBill = enabled ? Math.floor(payable / loyalty!.pointValueTaka) : 0;
  const maxRedeemable = Math.min(balance, maxByBill);
  const canRedeem = enabled && editable && maxRedeemable >= loyalty!.minRedeemPoints;

  if (!guest) {
    if (!editable) return null;
    return searching ? (
      <div className="space-y-2 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              className="h-8 pl-8 text-sm"
              placeholder="Name, phone or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cancel"
            onClick={() => setSearching(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-1">
          {(results?.data ?? [])
            .filter((result) => !result.email?.endsWith("@walk-in.dineflow"))
            .map((result) => (
              <li key={result._id}>
                <button
                  type="button"
                  disabled={patch.isPending}
                  onClick={() => patch.mutate({ customerId: result._id })}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    {result.name}
                    <span className="text-muted-foreground">
                      {result.phone ? ` · ${result.phone}` : ""}
                    </span>
                  </span>
                  {enabled && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {result.loyaltyPoints ?? 0} pts
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </div>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setSearching(true)}
      >
        <UserPlus className="h-4 w-4" />
        Add guest {enabled ? "to earn points" : "to this bill"}
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{guest.name}</p>
          {enabled && (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Gift className="h-3 w-3" />
              {balance.toLocaleString("en-IN")} points · worth {formatCurrency(balance * loyalty!.pointValueTaka)}
            </p>
          )}
        </div>
        {editable && !fromBooking && (
          <Button
            variant="ghost"
            size="sm"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ customerId: null })}
          >
            Remove
          </Button>
        )}
      </div>

      {editable && enabled && pointsRedeemed > 0 && (
        <div className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          <span>Spending {pointsRedeemed} points</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            disabled={patch.isPending}
            onClick={() => patch.mutate({ redeemPoints: 0 })}
          >
            Undo
          </Button>
        </div>
      )}

      {canRedeem && pointsRedeemed === 0 && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            patch.mutate({ redeemPoints: Number(redeem) || maxRedeemable });
          }}
        >
          <Input
            type="number"
            className="h-8 text-sm"
            min={loyalty!.minRedeemPoints}
            max={maxRedeemable}
            placeholder={`${loyalty!.minRedeemPoints}–${maxRedeemable} points`}
            value={redeem}
            onChange={(event) => setRedeem(event.target.value)}
          />
          <Button type="submit" size="sm" variant="outline" loading={patch.isPending}>
            Redeem
          </Button>
        </form>
      )}

      {enabled && editable && !canRedeem && pointsRedeemed === 0 && balance > 0 && (
        <p className="text-xs text-muted-foreground">
          {balance < loyalty!.minRedeemPoints
            ? `Can redeem from ${loyalty!.minRedeemPoints} points.`
            : "The bill is too small to redeem points on."}
        </p>
      )}
    </div>
  );
}
