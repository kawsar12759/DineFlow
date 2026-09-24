"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  CheckCheck,
  Clock,
  Phone,
  UserX,
  Utensils,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatTime } from "@/lib/utils";
import {
  RESERVATION_TRANSITIONS,
  type ReservationStatus,
} from "@/lib/constants";
import type {
  FloorReservation,
  FloorTable,
} from "@/components/dashboard/floor/floor-timeline";

const ACTION_META: Partial<
  Record<ReservationStatus, { label: string; icon: typeof Check }>
> = {
  approved: { label: "Approve", icon: Check },
  seated: { label: "Seat now", icon: Utensils },
  completed: { label: "Complete", icon: CheckCheck },
  no_show: { label: "No-show", icon: UserX },
  cancelled: { label: "Cancel", icon: Ban },
  rejected: { label: "Reject", icon: Ban },
};

export function ReservationDetailDialog({
  reservation,
  tables,
  slots,
  onOpenChange,
}: {
  reservation: FloorReservation | null;
  tables: FloorTable[];
  slots: string[];
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [moveTo, setMoveTo] = useState<string>("");

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/reservations/${reservation?._id}`, payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({ queryKey: ["floor"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      toast.success(
        payload.tableIds
          ? "Moved to another table"
          : payload.time
            ? "Reservation moved"
            : "Reservation updated"
      );
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not update"
      ),
  });

  if (!reservation) return null;

  const currentTables = tables.filter((table) =>
    reservation.tableIds.includes(table._id)
  );
  const nextStatuses = RESERVATION_TRANSITIONS[reservation.status];

  return (
    <Dialog open={!!reservation} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {reservation.customer.name}
            <StatusBadge status={reservation.status} />
          </DialogTitle>
          <DialogDescription>
            {formatTime(reservation.time)} · {reservation.guests}{" "}
            {reservation.guests === 1 ? "guest" : "guests"}
            {currentTables.length > 0 &&
              ` · ${currentTables.map((table) => table.name).join(" + ")}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1 text-sm">
            {reservation.customer.phone && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Phone className="h-4 w-4" />
                <a
                  href={`tel:${reservation.customer.phone}`}
                  className="hover:text-foreground"
                >
                  {reservation.customer.phone}
                </a>
              </p>
            )}
            {reservation.specialRequests && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">
                “{reservation.specialRequests}”
              </p>
            )}
            {!!reservation.customer.noShowCount && (
              <Badge variant="outline" className="text-orange-700">
                {reservation.customer.noShowCount} previous no-show
                {reservation.customer.noShowCount === 1 ? "" : "s"}
              </Badge>
            )}
          </div>

          {/* Status actions */}
          {nextStatuses.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((status) => {
                const meta = ACTION_META[status];
                if (!meta) return null;
                const Icon = meta.icon;
                return (
                  <Button
                    key={status}
                    size="sm"
                    variant={
                      status === "cancelled" || status === "rejected"
                        ? "outline"
                        : "default"
                    }
                    loading={update.isPending}
                    onClick={() => update.mutate({ status })}
                  >
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Move table */}
          {tables.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="move-table">Move to table</Label>
              <div className="flex gap-2">
                <Select value={moveTo} onValueChange={setMoveTo}>
                  <SelectTrigger id="move-table">
                    <SelectValue placeholder="Choose a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {tables
                      .filter((table) => !reservation.tableIds.includes(table._id))
                      .map((table) => (
                        <SelectItem key={table._id} value={table._id}>
                          {table.name} · {table.seats} seats
                          {table.seats < reservation.guests ? " (too small)" : ""}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  disabled={!moveTo}
                  loading={update.isPending}
                  onClick={() => update.mutate({ tableIds: [moveTo] })}
                >
                  Move
                </Button>
              </div>
            </div>
          )}

          {/* Reschedule */}
          <div className="space-y-1.5">
            <Label htmlFor="move-time">Change time</Label>
            <Select
              value={reservation.time}
              onValueChange={(time) => update.mutate({ time })}
            >
              <SelectTrigger id="move-time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {slots.map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {formatTime(slot)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              The party is re-seated automatically if its table is busy.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
