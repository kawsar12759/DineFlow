"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, UserPlus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { currentTime } from "@/lib/dates";
import { formatTime } from "@/lib/utils";
import { PHONE_PLACEHOLDER } from "@/lib/constants";

/** Nearest bookable slot to the current time, for seating walk-ins. */
function nearestSlot(slots: string[], now: string) {
  if (slots.length === 0) return "";
  return (
    [...slots].reverse().find((slot) => slot <= now) ?? slots[0]
  );
}

export function WalkInDialog({
  open,
  onOpenChange,
  branchId,
  date,
  slots,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  date: string;
  slots: string[];
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState("");
  const [noTable, setNoTable] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setGuests(2);
      setNoTable(false);
      setTime(nearestSlot(slots, currentTime()));
    }
  }, [open, slots]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["floor"] });
    queryClient.invalidateQueries({ queryKey: ["waitlist"] });
    queryClient.invalidateQueries({ queryKey: ["reservations"] });
  };

  const seat = useMutation({
    mutationFn: () =>
      api.post("/api/reservations", {
        branchId,
        date,
        time,
        guests,
        status: "seated",
        customer: {
          name,
          email: `walkin-${Date.now()}@walk-in.dineflow`,
          phone: phone || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`${name} seated`);
      refresh();
      onOpenChange(false);
    },
    onError: (error) => {
      const message =
        error instanceof ApiClientError ? error.message : "Could not seat party";
      // Offer the waitlist when the floor is full.
      if (error instanceof ApiClientError && error.status === 409) {
        setNoTable(true);
      }
      toast.error(message);
    },
  });

  const addToWaitlist = useMutation({
    mutationFn: () =>
      api.post("/api/waitlist", {
        branchId,
        date,
        name,
        phone: phone || undefined,
        guests,
      }),
    onSuccess: () => {
      toast.success(`${name} added to the waitlist`);
      refresh();
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not add to waitlist"
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Walk-in</DialogTitle>
          <DialogDescription>
            Seat a party that just arrived, or add them to the waitlist if the
            floor is full.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-name">Guest name</Label>
              <Input
                id="walkin-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nusrat Jahan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-phone">Phone (optional)</Label>
              <Input
                id="walkin-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={PHONE_PLACEHOLDER}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="walkin-guests">Guests</Label>
              <Input
                id="walkin-guests"
                type="number"
                min={1}
                max={50}
                value={guests}
                onChange={(event) =>
                  setGuests(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="walkin-time">Seat at</Label>
              <Select value={time} onValueChange={setTime}>
                <SelectTrigger id="walkin-time">
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {formatTime(slot)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {noTable && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              No table is free for this party right now. Add them to the waitlist
              and seat them when one frees up.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={name.trim().length < 2}
            loading={addToWaitlist.isPending}
            onClick={() => addToWaitlist.mutate()}
          >
            <Clock className="h-4 w-4" />
            Add to waitlist
          </Button>
          <Button
            disabled={name.trim().length < 2 || !time}
            loading={seat.isPending}
            onClick={() => seat.mutate()}
          >
            <UserPlus className="h-4 w-4" />
            Seat now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
