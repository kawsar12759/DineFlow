"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { cn, formatTime } from "@/lib/utils";

interface SlotStatus {
  time: string;
  seatsLeft: number;
  available: boolean;
  reason?: "past" | "full" | "party";
}

interface Availability {
  date: string;
  closed: boolean;
  hours: string;
  capacity: number;
  maxPartySize: number;
  partyTooLarge: boolean;
  slots: SlotStatus[];
}

export interface BookingBranch {
  _id: string;
  name: string;
  city: string;
  hours: string;
}

export function BookingWidget({
  restaurantId,
  branches,
  maxDaysAhead,
}: {
  restaurantId: string;
  branches: BookingBranch[];
  maxDaysAhead: number;
}) {
  const [branchId, setBranchId] = useState(branches[0]?._id ?? "");
  const [date, setDate] = useState(todayKey());
  const [guests, setGuests] = useState(2);
  const [time, setTime] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    status: string;
    manageUrl: string;
  } | null>(null);
  const [guest, setGuest] = useState({
    name: "",
    email: "",
    phone: "",
    specialRequests: "",
  });

  const { data, isFetching } = useQuery({
    queryKey: ["availability", branchId, date, guests],
    queryFn: () =>
      api.get<Availability>(
        `/api/public/availability?branchId=${branchId}&date=${date}&guests=${guests}`
      ),
    enabled: !!branchId,
  });
  const availability = data?.data;

  // A slot picked for one day may not exist on another.
  useEffect(() => {
    setTime((current) =>
      current && availability?.slots.some((s) => s.time === current && s.available)
        ? current
        : null
    );
  }, [availability]);

  const book = useMutation({
    mutationFn: () =>
      api.post<{
        reservationId: string;
        status: string;
        branch: string;
        manageUrl: string;
      }>(
        "/api/public/reservations",
        {
          restaurantId,
          branchId,
          date,
          time,
          guests,
          name: guest.name,
          email: guest.email,
          phone: guest.phone || undefined,
          specialRequests: guest.specialRequests || undefined,
        }
      ),
    onSuccess: (response) => {
      setConfirmation({
        status: response.data.status,
        manageUrl: response.data.manageUrl,
      });
      setTime(null);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not complete the booking"
      ),
  });

  if (confirmation) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h3 className="mt-3 text-lg font-semibold">
          {confirmation.status === "approved"
            ? "Table confirmed"
            : "Request received"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {confirmation.status === "approved"
            ? `You're booked for ${guests} on ${date}. We look forward to seeing you.`
            : "The restaurant will confirm your table shortly."}
        </p>
        <div className="mt-4 flex flex-col items-center gap-2">
          <Button asChild>
            <a href={confirmation.manageUrl}>View or change your booking</a>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setConfirmation(null);
              setGuest({ name: "", email: "", phone: "", specialRequests: "" });
            }}
          >
            Book another table
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-4 rounded-xl border bg-card p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (!time) {
          toast.error("Choose a time first");
          return;
        }
        book.mutate();
      }}
    >
      <div className="flex items-center gap-2">
        <CalendarCheck className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Book a table</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-3">
          <Label htmlFor="branch">Branch</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger id="branch">
              <SelectValue placeholder="Choose a branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name} — {branch.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={date}
            min={todayKey()}
            max={addDaysToKey(todayKey(), maxDaysAhead)}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="guests">Guests</Label>
          <Input
            id="guests"
            type="number"
            min={1}
            max={availability?.maxPartySize ?? 20}
            value={guests}
            onChange={(event) =>
              setGuests(Math.max(1, Number(event.target.value) || 1))
            }
          />
        </div>
      </div>

      {/* Slots */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Time</Label>
          {isFetching && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
        </div>

        {!availability ? (
          <Skeleton className="h-20 w-full" />
        ) : availability.closed ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Closed on this date. Opening hours: {availability.hours || "not set"}.
          </p>
        ) : availability.partyTooLarge ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Online booking takes parties of up to {availability.maxPartySize}.
            For a larger group, please call the restaurant.
          </p>
        ) : availability.slots.every((slot) => !slot.available) ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            {availability.slots.every((slot) => slot.reason === "past")
              ? "Today's sittings have already started. Please pick another date."
              : `No tables left for ${guests} ${guests === 1 ? "guest" : "guests"} on this date. Try another day or a smaller party.`}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {availability.slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                aria-pressed={time === slot.time}
                title={
                  slot.available
                    ? `${slot.seatsLeft} seats left`
                    : slot.reason === "past"
                      ? "Too late to book this time"
                      : slot.reason === "party"
                        ? "Party too large to book online"
                        : "Fully booked"
                }
                onClick={() => setTime(slot.time)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-sm transition-colors",
                  slot.available
                    ? "hover:border-primary hover:text-primary"
                    : "cursor-not-allowed text-muted-foreground/50 line-through",
                  time === slot.time &&
                    "border-primary bg-primary text-primary-foreground hover:text-primary-foreground"
                )}
              >
                {formatTime(slot.time)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="guest-name">Full name</Label>
          <Input
            id="guest-name"
            required
            value={guest.name}
            onChange={(event) => setGuest({ ...guest, name: event.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="guest-phone">Phone (optional)</Label>
          <Input
            id="guest-phone"
            placeholder="+880 1712-345678"
            value={guest.phone}
            onChange={(event) => setGuest({ ...guest, phone: event.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="guest-email">Email</Label>
          <Input
            id="guest-email"
            type="email"
            required
            value={guest.email}
            onChange={(event) => setGuest({ ...guest, email: event.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="guest-requests">Special requests (optional)</Label>
          <Textarea
            id="guest-requests"
            rows={2}
            placeholder="Window seat, birthday, allergies…"
            value={guest.specialRequests}
            onChange={(event) =>
              setGuest({ ...guest, specialRequests: event.target.value })
            }
          />
        </div>
      </div>

      <Button type="submit" className="w-full" size="lg" loading={book.isPending}>
        <Users className="h-4 w-4" />
        {time
          ? `Book ${guests} for ${formatTime(time)}`
          : "Choose a time to book"}
      </Button>
    </form>
  );
}
