"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import {
  bookingSettingsSchema,
  restaurantProfileSchema,
  type BookingSettingsInput,
  type RestaurantProfileInput,
} from "@/lib/validations";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BookingSettings } from "@/lib/constants";

interface RestaurantSettings {
  _id: string;
  name: string;
  slug: string;
  cuisine?: string;
  description?: string;
  logo?: string;
  phone?: string;
  email?: string;
  website?: string;
  isPublished: boolean;
  bookingSettings: BookingSettings;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.get<RestaurantSettings>("/api/settings"),
  });
  const settings = data?.data;

  const profileForm = useForm<RestaurantProfileInput>({
    resolver: zodResolver(restaurantProfileSchema),
  });
  const bookingForm = useForm<BookingSettingsInput>({
    resolver: zodResolver(bookingSettingsSchema),
  });

  useEffect(() => {
    if (!settings) return;
    profileForm.reset({
      name: settings.name,
      cuisine: settings.cuisine ?? "",
      description: settings.description ?? "",
      logo: settings.logo ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      website: settings.website ?? "",
      isPublished: settings.isPublished,
    });
    bookingForm.reset(settings.bookingSettings);
  }, [settings, profileForm, bookingForm]);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch("/api/settings", payload),
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not save settings"
      ),
  });

  if (isLoading || !settings) {
    return (
      <>
        <PageHeader title="Settings" description="Your restaurant and booking rules." />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </>
    );
  }

  const published = profileForm.watch("isPublished");

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your restaurant profile and the rules guests book by."
      >
        <Button variant="outline" asChild>
          <Link href={`/r/${settings.slug}`} target="_blank">
            View public page
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </PageHeader>

      {/* Restaurant profile */}
      <Card>
        <form
          onSubmit={profileForm.handleSubmit((values) =>
            save.mutate({ profile: values })
          )}
        >
          <CardHeader>
            <CardTitle>Restaurant profile</CardTitle>
            <CardDescription>
              Shown to guests on your public page at /r/{settings.slug}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="name">Restaurant name</Label>
                <Input id="name" {...profileForm.register("name")} />
                <FieldError message={profileForm.formState.errors.name?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cuisine">Cuisine</Label>
                <Input
                  id="cuisine"
                  placeholder="Wood-fired Continental"
                  {...profileForm.register("cuisine")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="What makes your restaurant worth a visit?"
                {...profileForm.register("description")}
              />
              <FieldError
                message={profileForm.formState.errors.description?.message}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+880 1712-345678"
                  {...profileForm.register("phone")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...profileForm.register("email")} />
                <FieldError message={profileForm.formState.errors.email?.message} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
                  {...profileForm.register("website")}
                />
                <FieldError message={profileForm.formState.errors.website?.message} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="logo">Logo URL</Label>
                <Input
                  id="logo"
                  placeholder="https://…/logo.png"
                  {...profileForm.register("logo")}
                />
                <FieldError message={profileForm.formState.errors.logo?.message} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="isPublished">Public page and online booking</Label>
                <p className="text-xs text-muted-foreground">
                  {published
                    ? "Guests can find you and book online."
                    : "Your page is hidden and online bookings are turned off."}
                </p>
              </div>
              <Switch
                id="isPublished"
                checked={!!published}
                onCheckedChange={(checked) =>
                  profileForm.setValue("isPublished", checked, {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={save.isPending}>
              Save profile
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Booking rules */}
      <Card>
        <form
          onSubmit={bookingForm.handleSubmit((values) =>
            save.mutate({ bookingSettings: values })
          )}
        >
          <CardHeader>
            <CardTitle>Booking rules</CardTitle>
            <CardDescription>
              These decide which times guests can pick and how many seats each
              booking holds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="diningDurationMinutes">
                  Table held for (minutes)
                </Label>
                <Input
                  id="diningDurationMinutes"
                  type="number"
                  min={30}
                  max={300}
                  step={15}
                  {...bookingForm.register("diningDurationMinutes")}
                />
                <p className="text-xs text-muted-foreground">
                  How long a party occupies its seats.
                </p>
                <FieldError
                  message={
                    bookingForm.formState.errors.diningDurationMinutes?.message
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slotIntervalMinutes">Time slots every (minutes)</Label>
                <Input
                  id="slotIntervalMinutes"
                  type="number"
                  min={15}
                  max={60}
                  step={15}
                  {...bookingForm.register("slotIntervalMinutes")}
                />
                <FieldError
                  message={bookingForm.formState.errors.slotIntervalMinutes?.message}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="maxPartySize">Largest party online</Label>
                <Input
                  id="maxPartySize"
                  type="number"
                  min={1}
                  max={50}
                  {...bookingForm.register("maxPartySize")}
                />
                <FieldError
                  message={bookingForm.formState.errors.maxPartySize?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="minLeadMinutes">Book at least (minutes ahead)</Label>
                <Input
                  id="minLeadMinutes"
                  type="number"
                  min={0}
                  max={10080}
                  step={15}
                  {...bookingForm.register("minLeadMinutes")}
                />
                <FieldError
                  message={bookingForm.formState.errors.minLeadMinutes?.message}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maxDaysAhead">Book up to (days ahead)</Label>
                <Input
                  id="maxDaysAhead"
                  type="number"
                  min={1}
                  max={365}
                  {...bookingForm.register("maxDaysAhead")}
                />
                <FieldError
                  message={bookingForm.formState.errors.maxDaysAhead?.message}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="autoApprove">Confirm bookings automatically</Label>
                <p className="text-xs text-muted-foreground">
                  {bookingForm.watch("autoApprove")
                    ? "Online bookings are confirmed straight away."
                    : "Online bookings wait for someone to approve them."}
                </p>
              </div>
              <Switch
                id="autoApprove"
                checked={!!bookingForm.watch("autoApprove")}
                onCheckedChange={(checked) =>
                  bookingForm.setValue("autoApprove", checked, {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={save.isPending}>
              Save booking rules
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
