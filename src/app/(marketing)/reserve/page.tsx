"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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

const bookingFormSchema = z.object({
  branchId: z.string().min(1, "Please choose a branch"),
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  guests: z.coerce.number().int().min(1, "At least 1 guest").max(50),
  specialRequests: z.string().max(500).optional(),
});

type BookingForm = z.infer<typeof bookingFormSchema>;

interface PublicBranch {
  _id: string;
  name: string;
  restaurantId: string;
  address: { city: string };
  restaurant?: { name: string } | null;
}

const TIME_SLOTS = Array.from({ length: 28 }, (_, index) => {
  const totalMinutes = 11 * 60 + index * 30; // 11:00 → 24:30
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function ReserveForm() {
  const searchParams = useSearchParams();
  const preselectedBranch = searchParams.get("branch") ?? "";
  const [confirmed, setConfirmed] = useState<string | null>(null);

  const { data: branchData, isLoading: branchesLoading } = useQuery({
    queryKey: ["public-branches", ""],
    queryFn: () => api.get<PublicBranch[]>("/api/public/branches"),
  });

  const branches = branchData?.data ?? [];

  const form = useForm<BookingForm>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      branchId: preselectedBranch,
      guests: 2,
      date: new Date().toISOString().slice(0, 10),
      time: "19:00",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: BookingForm) => {
      const branch = branches.find((item) => item._id === values.branchId);
      if (!branch) throw new Error("Branch not found");
      return api.post<{ reservationId: string; branch: string }>(
        "/api/public/reservations",
        { ...values, restaurantId: branch.restaurantId }
      );
    },
    onSuccess: (response) => {
      setConfirmed(response.data.branch);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Booking failed — please try again"
      );
    },
  });

  if (confirmed) {
    return (
      <Card className="mx-auto max-w-lg text-center">
        <CardContent className="p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold">Request received!</h2>
          <p className="mt-3 text-muted-foreground">
            Your reservation request at <strong>{confirmed}</strong> is pending
            approval. You&apos;ll receive a confirmation shortly at the email
            you provided.
          </p>
          <Button
            className="mt-6"
            variant="outline"
            onClick={() => {
              setConfirmed(null);
              form.reset();
            }}
          >
            Make another booking
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          Reservation details
        </CardTitle>
        <CardDescription>
          Choose a branch, pick a time, and we&apos;ll hold your table.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-1.5">
            <Label>Branch</Label>
            {branchesLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select
                value={form.watch("branchId")}
                onValueChange={(value) =>
                  form.setValue("branchId", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name} — {branch.address.city}
                      {branch.restaurant ? ` (${branch.restaurant.name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {form.formState.errors.branchId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.branchId.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                {...form.register("date")}
              />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Time</Label>
              <Select
                value={form.watch("time")}
                onValueChange={(value) =>
                  form.setValue("time", value, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {slot}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="guests">Guests</Label>
            <Input
              id="guests"
              type="number"
              min={1}
              max={50}
              {...form.register("guests")}
            />
            {form.formState.errors.guests && (
              <p className="text-xs text-destructive">
                {form.formState.errors.guests.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Jane Smith" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" placeholder="+1 555 000 1234" {...form.register("phone")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="jane@example.com"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="specialRequests">Special requests (optional)</Label>
            <Textarea
              id="specialRequests"
              placeholder="Window seat, anniversary, allergies…"
              {...form.register("specialRequests")}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={mutation.isPending}
          >
            Request reservation
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function ReservePage() {
  return (
    <div className="container py-20">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Book a table
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Reserve at any DineFlow partner restaurant. Requests are confirmed by
          the venue, usually within minutes.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-lg" />}>
        <ReserveForm />
      </Suspense>
    </div>
  );
}
