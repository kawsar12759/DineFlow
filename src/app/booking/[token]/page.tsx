"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarX,
  Clock,
  MapPin,
  Phone,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { cn, formatDate, formatTime } from "@/lib/utils";
import type { BookingSettings, ReservationStatus } from "@/lib/constants";

interface Booking {
  reservationId: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string;
  guest: { name: string; email: string };
  branch: {
    _id: string;
    name: string;
    address: { street: string; city: string; zip?: string };
    phone?: string;
  };
  restaurant: { name: string; slug: string; phone?: string };
  settings: BookingSettings;
}

interface SlotStatus {
  time: string;
  available: boolean;
}

export default function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [guests, setGuests] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["booking", token],
    queryFn: () => api.get<Booking>(`/api/public/bookings/${token}`),
    retry: false,
  });
  const booking = data?.data;

  const activeDate = date || booking?.date || todayKey();
  const activeGuests = guests || booking?.guests || 2;

  const { data: availabilityData } = useQuery({
    queryKey: ["availability", booking?.branch._id, activeDate, activeGuests],
    queryFn: () =>
      api.get<{ slots: SlotStatus[]; closed: boolean }>(
        `/api/public/availability?branchId=${booking!.branch._id}&date=${activeDate}&guests=${activeGuests}`
      ),
    enabled: editing && !!booking,
  });

  const change = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch(`/api/public/bookings/${token}`, payload),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ["booking", token] });
      setEditing(false);
      setCancelOpen(false);
      toast.success(
        payload.action === "cancel" ? "Booking cancelled" : "Booking updated"
      );
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not change this booking"
      ),
  });

  if (isLoading) {
    return (
      <div className="container max-w-2xl py-16">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <CalendarX className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Booking link not valid</h1>
        <p className="mt-2 text-muted-foreground">
          This link may have expired, or the booking was removed. Please contact
          the restaurant directly.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Back to DineFlow</Link>
        </Button>
      </div>
    );
  }

  const changeable = ["pending", "approved"].includes(booking.status);

  return (
    <div className="container max-w-2xl space-y-6 py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {booking.restaurant.name}
          </h1>
          <p className="text-sm text-muted-foreground">Your booking</p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold">
                {formatDate(`${booking.date}T00:00:00Z`)} at{" "}
                {formatTime(booking.time)}
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                {booking.guests} {booking.guests === 1 ? "guest" : "guests"} ·{" "}
                {booking.guest.name}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {booking.status === "pending" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              The restaurant will confirm this booking shortly.
            </p>
          )}

          <div className="space-y-2 border-t pt-4 text-sm text-muted-foreground">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {booking.branch.name} — {booking.branch.address.street},{" "}
                {booking.branch.address.city}
              </span>
            </p>
            {(booking.branch.phone ?? booking.restaurant.phone) && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0" />
                <a
                  className="hover:text-foreground"
                  href={`tel:${booking.branch.phone ?? booking.restaurant.phone}`}
                >
                  {booking.branch.phone ?? booking.restaurant.phone}
                </a>
              </p>
            )}
            {booking.specialRequests && (
              <p className="rounded-lg bg-muted px-3 py-2">
                “{booking.specialRequests}”
              </p>
            )}
          </div>

          {changeable ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant={editing ? "outline" : "default"}
                onClick={() => {
                  setEditing((value) => !value);
                  setDate(booking.date);
                  setGuests(booking.guests);
                }}
              >
                <CalendarCheck className="h-4 w-4" />
                {editing ? "Keep as it is" : "Change booking"}
              </Button>
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                <CalendarX className="h-4 w-4" />
                Cancel booking
              </Button>
            </div>
          ) : (
            <p className="border-t pt-4 text-sm text-muted-foreground">
              This booking can no longer be changed online. Please call the
              restaurant if you need help.
            </p>
          )}
        </CardContent>
      </Card>

      {editing && changeable && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <h2 className="font-medium">Pick a new time</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-date">Date</Label>
                <Input
                  id="new-date"
                  type="date"
                  value={activeDate}
                  min={todayKey()}
                  max={addDaysToKey(todayKey(), booking.settings.maxDaysAhead)}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-guests">Guests</Label>
                <Input
                  id="new-guests"
                  type="number"
                  min={1}
                  max={booking.settings.maxPartySize}
                  value={activeGuests}
                  onChange={(event) =>
                    setGuests(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </div>
            </div>

            {availabilityData?.data.closed ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Closed on this date — please choose another.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(availabilityData?.data.slots ?? []).map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available || change.isPending}
                    onClick={() =>
                      change.mutate({
                        action: "reschedule",
                        date: activeDate,
                        time: slot.time,
                        guests: activeGuests,
                      })
                    }
                    className={cn(
                      "rounded-lg border px-2 py-2 text-sm transition-colors",
                      slot.available
                        ? "hover:border-primary hover:text-primary"
                        : "cursor-not-allowed text-muted-foreground/50 line-through",
                      slot.time === booking.time &&
                        activeDate === booking.date &&
                        "border-primary text-primary"
                    )}
                  >
                    {formatTime(slot.time)}
                  </button>
                ))}
              </div>
            )}

            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Choosing a time saves the change straight away.
              {!booking.settings.autoApprove &&
                " The restaurant will confirm it again."}
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground">
        <Link href={`/r/${booking.restaurant.slug}`} className="hover:text-foreground">
          View {booking.restaurant.name}
        </Link>
      </p>

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this booking?"
        description={`Your table on ${formatDate(`${booking.date}T00:00:00Z`)} at ${formatTime(booking.time)} will be released.`}
        confirmLabel="Cancel booking"
        onConfirm={() => change.mutate({ action: "cancel" })}
      />

      {booking.status === "cancelled" && (
        <Badge variant="outline" className="mx-auto block w-fit">
          This booking is cancelled
        </Badge>
      )}
    </div>
  );
}
