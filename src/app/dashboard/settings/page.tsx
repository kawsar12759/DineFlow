"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import {
  billingSettingsSchema,
  bookingSettingsSchema,
  loyaltySettingsSchema,
  restaurantProfileSchema,
  type BillingSettingsInput,
  type BookingSettingsInput,
  type LoyaltySettingsInput,
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
import { ImageUpload } from "@/components/shared/image-upload";
import type {
  BillingSettings,
  BookingSettings,
  FeedbackSettings,
  LoyaltySettings,
} from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

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
  billingSettings: BillingSettings;
  loyaltySettings: LoyaltySettings;
  feedbackSettings: FeedbackSettings;
  planIncludesLoyalty: boolean;
}

type Section = "profile" | "booking" | "bills" | "loyalty" | "feedback";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "profile", label: "Restaurant profile" },
  { id: "booking", label: "Booking rules" },
  { id: "bills", label: "Bills" },
  { id: "loyalty", label: "Loyalty points" },
  { id: "feedback", label: "Guest feedback" },
];

/** Save button for one settings card; it only lights up once something changed. */
function SaveFooter({
  dirty,
  saving,
  label,
}: {
  dirty: boolean;
  saving: boolean;
  label: string;
}) {
  return (
    <CardFooter className="justify-end gap-3">
      {dirty && !saving && (
        <span className="text-xs text-amber-700 dark:text-amber-300">Unsaved changes</span>
      )}
      <Button type="submit" loading={saving} disabled={!dirty}>
        {label}
      </Button>
    </CardFooter>
  );
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
  const billingForm = useForm<BillingSettingsInput>({
    resolver: zodResolver(billingSettingsSchema),
  });
  const loyaltyForm = useForm<LoyaltySettingsInput>({
    resolver: zodResolver(loyaltySettingsSchema),
  });

  const profileDirty = profileForm.formState.isDirty;
  const bookingDirty = bookingForm.formState.isDirty;
  const billingDirty = billingForm.formState.isDirty;
  const loyaltyDirty = loyaltyForm.formState.isDirty;
  const anyDirty = profileDirty || bookingDirty || billingDirty || loyaltyDirty;

  // Saving one card refetches everything; don't wipe edits in the others.
  useEffect(() => {
    if (!settings) return;
    if (!profileForm.formState.isDirty) profileForm.reset({
      name: settings.name,
      cuisine: settings.cuisine ?? "",
      description: settings.description ?? "",
      logo: settings.logo ?? "",
      phone: settings.phone ?? "",
      email: settings.email ?? "",
      website: settings.website ?? "",
      isPublished: settings.isPublished,
    });
    if (!bookingForm.formState.isDirty) bookingForm.reset(settings.bookingSettings);
    if (!billingForm.formState.isDirty) billingForm.reset(settings.billingSettings);
    if (!loyaltyForm.formState.isDirty) loyaltyForm.reset(settings.loyaltySettings);
  }, [settings, profileForm, bookingForm, billingForm, loyaltyForm]);

  // Warn before leaving the page with edits that were never saved.
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  const [activeSection, setActiveSection] = useState<Section>("profile");

  // Highlight the section being read in the side menu.
  useEffect(() => {
    if (!settings) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (visible) setActiveSection(visible.target.id as Section);
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [settings]);

  const save = useMutation({
    mutationFn: ({ payload }: { section: Section; payload: Record<string, unknown> }) =>
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

  const savingSection = save.isPending ? save.variables?.section : undefined;

  const published = profileForm.watch("isPublished");
  const loyaltyOn = loyaltyForm.watch("enabled");
  const earnRate = Number(loyaltyForm.watch("pointsPer100Taka")) || 0;
  const pointValue = Number(loyaltyForm.watch("pointValueTaka")) || 0;
  const minRedeem = Number(loyaltyForm.watch("minRedeemPoints")) || 0;
  // A worked example for the owner: what a ৳1,000 bill earns.
  const examplePoints = Math.floor(10 * earnRate);

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

      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <nav
          aria-label="Settings sections"
          className="sticky top-20 hidden space-y-1 lg:block"
        >
          {SECTIONS.map((section) => {
            const dirty =
              (section.id === "profile" && profileDirty) ||
              (section.id === "booking" && bookingDirty) ||
              (section.id === "bills" && billingDirty) ||
              (section.id === "loyalty" && loyaltyDirty);
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setActiveSection(section.id)}
                aria-current={activeSection === section.id ? "true" : undefined}
                className={
                  "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent " +
                  (activeSection === section.id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground")
                }
              >
                {section.label}
                {dirty && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-500"
                    aria-label="Unsaved changes"
                  />
                )}
              </a>
            );
          })}
        </nav>
        <div className="space-y-6">
          {/* Restaurant profile */}
          <Card id="profile" className="scroll-mt-24">
            <form
              onSubmit={profileForm.handleSubmit((values) =>
                save.mutate(
                  { section: "profile", payload: { profile: values } },
                  { onSuccess: () => profileForm.reset(values) }
                )
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
                </div>

                <div className="space-y-1.5">
                  <Label>Logo</Label>
                  <ImageUpload
                    kind="logo"
                    shape="square"
                    value={profileForm.watch("logo")}
                    onChange={(url) =>
                      profileForm.setValue("logo", url, { shouldDirty: true })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Shown on your public page. A square image works best.
                  </p>
                  <FieldError message={profileForm.formState.errors.logo?.message} />
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
              <SaveFooter
                dirty={profileDirty}
                saving={savingSection === "profile"}
                label="Save profile"
              />
            </form>
          </Card>

          {/* Booking rules */}
          <Card id="booking" className="scroll-mt-24">
            <form
              onSubmit={bookingForm.handleSubmit((values) =>
                save.mutate(
                  { section: "booking", payload: { bookingSettings: values } },
                  { onSuccess: () => bookingForm.reset(values) }
                )
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
              <SaveFooter
                dirty={bookingDirty}
                saving={savingSection === "booking"}
                label="Save booking rules"
              />
            </form>
          </Card>

          {/* Bills */}
          <Card id="bills" className="scroll-mt-24">
            <form
              onSubmit={billingForm.handleSubmit((values) =>
                save.mutate(
                  { section: "bills", payload: { billingSettings: values } },
                  { onSuccess: () => billingForm.reset(values) }
                )
              )}
            >
              <CardHeader>
                <CardTitle>Bills</CardTitle>
                <CardDescription>
                  Charged on every bill after any discount. Bangladeshi restaurants
                  normally add 5% VAT and a 10% service charge.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="vatPercent">VAT (%)</Label>
                  <Input
                    id="vatPercent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    {...billingForm.register("vatPercent")}
                  />
                  <FieldError
                    message={billingForm.formState.errors.vatPercent?.message}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="serviceChargePercent">Service charge (%)</Label>
                  <Input
                    id="serviceChargePercent"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    {...billingForm.register("serviceChargePercent")}
                  />
                  <FieldError
                    message={
                      billingForm.formState.errors.serviceChargePercent?.message
                    }
                  />
                </div>
              </CardContent>
              <SaveFooter
                dirty={billingDirty}
                saving={savingSection === "bills"}
                label="Save bill settings"
              />
            </form>
          </Card>

          {/* Loyalty */}
          <Card id="loyalty" className="scroll-mt-24">
            <form
              onSubmit={loyaltyForm.handleSubmit((values) =>
                save.mutate(
                  {
                    section: "loyalty",
                    payload: {
                      loyaltySettings: {
                        ...values,
                        enabled: values.enabled && settings.planIncludesLoyalty,
                      },
                    },
                  },
                  { onSuccess: () => loyaltyForm.reset(values) }
                )
              )}
            >
              <CardHeader>
                <CardTitle>Loyalty points</CardTitle>
                <CardDescription>
                  Guests earn points on every paid bill and spend them as taka off a
                  later one. Points are earned on food after discounts, not on VAT or
                  service charge.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!settings.planIncludesLoyalty && (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                    Loyalty points are part of the Growth plan.{" "}
                    <Link href="/dashboard/billing" className="text-primary hover:underline">
                      Upgrade in Billing
                    </Link>{" "}
                    to turn them on. Guests keep any points they already have.
                  </p>
                )}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="loyaltyEnabled">Run a loyalty programme</Label>
                    <p className="text-xs text-muted-foreground">
                      {loyaltyOn
                        ? "Guests attached to a bill earn points when it is paid."
                        : "No points are earned or redeemed. Existing balances are kept."}
                    </p>
                  </div>
                  <Switch
                    id="loyaltyEnabled"
                    disabled={!settings.planIncludesLoyalty}
                    checked={!!loyaltyOn && settings.planIncludesLoyalty}
                    onCheckedChange={(checked) =>
                      loyaltyForm.setValue("enabled", checked, { shouldDirty: true })
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pointsPer100Taka">Points per ৳100 spent</Label>
                    <Input
                      id="pointsPer100Taka"
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      {...loyaltyForm.register("pointsPer100Taka")}
                    />
                    <FieldError
                      message={loyaltyForm.formState.errors.pointsPer100Taka?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pointValueTaka">One point is worth (৳)</Label>
                    <Input
                      id="pointValueTaka"
                      type="number"
                      min={0.01}
                      max={100}
                      step={0.01}
                      {...loyaltyForm.register("pointValueTaka")}
                    />
                    <FieldError
                      message={loyaltyForm.formState.errors.pointValueTaka?.message}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="minRedeemPoints">Redeem from (points)</Label>
                    <Input
                      id="minRedeemPoints"
                      type="number"
                      min={1}
                      {...loyaltyForm.register("minRedeemPoints")}
                    />
                    <FieldError
                      message={loyaltyForm.formState.errors.minRedeemPoints?.message}
                    />
                  </div>
                </div>

                <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                  A ৳1,000 bill earns {examplePoints} points, worth{" "}
                  {formatCurrency(examplePoints * pointValue)} off a later visit.
                  Guests can redeem once they have {minRedeem} points (
                  {formatCurrency(minRedeem * pointValue)} off).
                </p>
              </CardContent>
              <SaveFooter
                dirty={loyaltyDirty}
                saving={savingSection === "loyalty"}
                label="Save loyalty settings"
              />
            </form>
          </Card>

          {/* Feedback */}
          <Card id="feedback" className="scroll-mt-24">
            <CardHeader>
              <CardTitle>Guest feedback</CardTitle>
              <CardDescription>
                After a visit is paid or completed, the guest can rate it from 1 to 5
                stars and leave a comment. Reviews appear under Feedback.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="requestAfterVisit">Ask guests for feedback</Label>
                  <p className="text-xs text-muted-foreground">
                    Email a &ldquo;How was your visit?&rdquo; link once the bill is closed.
                  </p>
                </div>
                <Switch
                  id="requestAfterVisit"
                  checked={settings.feedbackSettings.requestAfterVisit}
                  disabled={savingSection === "feedback"}
                  onCheckedChange={(checked) =>
                    save.mutate({
                      section: "feedback",
                      payload: { feedbackSettings: { requestAfterVisit: checked } },
                    })
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="showOnPublicPage">Show reviews on your public page</Label>
                  <p className="text-xs text-muted-foreground">
                    Your average rating and recent comments, with your replies. You can
                    hide single reviews from the Feedback page.
                  </p>
                </div>
                <Switch
                  id="showOnPublicPage"
                  checked={settings.feedbackSettings.showOnPublicPage}
                  disabled={savingSection === "feedback"}
                  onCheckedChange={(checked) =>
                    save.mutate({
                      section: "feedback",
                      payload: { feedbackSettings: { showOnPublicPage: checked } },
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
