"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  Gift,
  LogOut,
  Mail,
  MapPin,
  MessageSquareHeart,
  Star,
  Users,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/shared/status-badge";
import { StarRating } from "@/components/shared/star-rating";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/constants";

interface Visit {
  _id: string;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  restaurant: { name: string; slug: string };
  branch: { name: string; address: string };
  manageUrl?: string;
  feedback: { rating: number; replied: boolean } | null;
  feedbackUrl?: string;
}

interface Membership {
  restaurant: { name: string; slug?: string; cuisine?: string };
  visitCount: number;
  totalSpend: number;
  loyalty: {
    points: number;
    pointValueTaka: number;
    pointsPer100Taka: number;
    minRedeemPoints: number;
    history: { type: string; points: number; note?: string; createdAt: string }[];
  } | null;
}

interface Portal {
  email: string;
  name: string;
  memberships: Membership[];
  upcoming: Visit[];
  past: Visit[];
}

export default function AccountPage() {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <Account />
    </Suspense>
  );
}

function PortalSkeleton() {
  return (
    <div className="container max-w-4xl space-y-4 py-12">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function Account() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["guest-portal"],
    queryFn: () => api.get<Portal>("/api/guest/portal"),
    retry: false,
  });

  const signOut = useMutation({
    mutationFn: () => api.post("/api/guest/sign-out", {}),
    onSuccess: () => queryClient.resetQueries({ queryKey: ["guest-portal"] }),
  });

  if (isLoading) return <PortalSkeleton />;

  if (error instanceof ApiClientError && error.status === 401) {
    return <SignIn />;
  }
  if (error || !data) {
    return (
      <div className="container max-w-md py-20 text-center text-muted-foreground">
        Something went wrong loading your bookings. Please refresh the page.
      </div>
    );
  }

  const portal = data.data;
  const firstName = portal.name.split(" ")[0];

  return (
    <div className="container max-w-4xl space-y-8 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {firstName ? `Hi, ${firstName}` : "Your bookings"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{portal.email}</p>
        </div>
        <Button
          variant="outline"
          loading={signOut.isPending}
          onClick={() => signOut.mutate()}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" />
          Upcoming
        </h2>
        {portal.upcoming.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No upcoming bookings.{" "}
              <Link href="/reserve" className="text-primary hover:underline">
                Book a table
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {portal.upcoming.map((visit) => (
              <VisitCard key={visit._id} visit={visit} />
            ))}
          </div>
        )}
      </section>

      {/* Loyalty and restaurants */}
      {portal.memberships.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gift className="h-5 w-5 text-primary" />
            Your restaurants
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {portal.memberships.map((membership) => (
              <MembershipCard key={membership.restaurant.name} membership={membership} />
            ))}
          </div>
        </section>
      )}

      {/* Past */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquareHeart className="h-5 w-5 text-primary" />
          Past visits
        </h2>
        {portal.past.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Your past visits will show here.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {portal.past.map((visit) => (
                <div
                  key={visit._id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {visit.restaurant.name}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {visit.branch.name}
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(`${visit.date}T00:00:00Z`)} at {formatTime(visit.time)} ·{" "}
                      {visit.guests} {visit.guests === 1 ? "guest" : "guests"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {visit.feedback ? (
                      <div className="flex items-center gap-2">
                        <StarRating value={visit.feedback.rating} />
                        {visit.feedback.replied && (
                          <Badge variant="secondary">Replied</Badge>
                        )}
                      </div>
                    ) : visit.feedbackUrl ? (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={visit.feedbackUrl}>
                          <Star className="h-3.5 w-3.5" />
                          Rate this visit
                        </Link>
                      </Button>
                    ) : (
                      <StatusBadge status={visit.status} />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}

function VisitCard({ visit }: { visit: Visit }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{visit.restaurant.name}</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(`${visit.date}T00:00:00Z`)} at {formatTime(visit.time)}
            </p>
          </div>
          <StatusBadge status={visit.status} />
        </div>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            {visit.branch.name} — {visit.branch.address}
          </p>
          <p className="flex items-center gap-2">
            <Users className="h-4 w-4 shrink-0" />
            {visit.guests} {visit.guests === 1 ? "guest" : "guests"}
          </p>
        </div>
        {visit.manageUrl && (
          <Button size="sm" variant="outline" className="w-full" asChild>
            <Link href={visit.manageUrl}>Change or cancel</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MembershipCard({ membership }: { membership: Membership }) {
  const { restaurant, loyalty } = membership;
  const worth = loyalty ? loyalty.points * loyalty.pointValueTaka : 0;
  const toGo = loyalty ? loyalty.minRedeemPoints - loyalty.points : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {restaurant.slug ? (
            <Link href={`/r/${restaurant.slug}`} className="hover:text-primary">
              {restaurant.name}
            </Link>
          ) : (
            restaurant.name
          )}
        </CardTitle>
        <CardDescription>
          {membership.visitCount} {membership.visitCount === 1 ? "visit" : "visits"} ·{" "}
          {formatCurrency(membership.totalSpend)} spent
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loyalty ? (
          <>
            <div className="flex items-baseline justify-between rounded-lg bg-primary/5 px-4 py-3">
              <div>
                <p className="text-2xl font-semibold text-primary">
                  {loyalty.points.toLocaleString("en-IN")}
                </p>
                <p className="text-xs text-muted-foreground">points</p>
              </div>
              <p className="text-right text-sm text-muted-foreground">
                worth {formatCurrency(worth)}
                <br />
                <span className="text-xs">
                  {toGo > 0
                    ? `${toGo} more to redeem`
                    : "Ask to redeem on your next bill"}
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Earn {loyalty.pointsPer100Taka} points per ৳100 spent.
            </p>
            {loyalty.history.length > 0 && (
              <ul className="space-y-1 text-sm">
                {loyalty.history.map((entry, index) => (
                  <li key={index} className="flex justify-between gap-2">
                    <span className="truncate text-muted-foreground">
                      {formatDate(entry.createdAt)} · {entry.note ?? entry.type}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 font-medium",
                        entry.points > 0 ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {entry.points > 0 ? "+" : ""}
                      {entry.points}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            This restaurant does not run a loyalty programme.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SignIn() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("link") === "expired";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = useMutation({
    mutationFn: () => api.post("/api/guest/sign-in", { email }),
    onSuccess: () => setSent(true),
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not send the link"
      ),
  });

  return (
    <div className="container max-w-md py-16">
      <Card>
        <CardHeader>
          <CardTitle>Your bookings</CardTitle>
          <CardDescription>
            See every booking, your loyalty points and past visits at DineFlow
            restaurants. No password — we email you a sign-in link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-center">
              <Mail className="mx-auto h-10 w-10 text-primary" />
              <p className="font-medium">Check your email</p>
              <p className="text-sm text-muted-foreground">
                If you have booked with a DineFlow restaurant using{" "}
                <span className="font-medium text-foreground">{email}</span>, a
                sign-in link is on its way. It works for 20 minutes.
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSent(false)}>
                Use another email
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                request.mutate();
              }}
            >
              {expired && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  That sign-in link has expired. Enter your email for a new one.
                </p>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="guest-email">Email you booked with</Label>
                <Input
                  id="guest-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" loading={request.isPending}>
                Email me a sign-in link
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Run a restaurant?{" "}
                <Link href="/login" className="hover:text-foreground hover:underline">
                  Staff sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
