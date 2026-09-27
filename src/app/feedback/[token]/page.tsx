"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX, CheckCircle2, UtensilsCrossed } from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { StarRating } from "@/components/shared/star-rating";
import { formatDate, formatTime } from "@/lib/utils";

interface Visit {
  restaurant: { name: string; slug: string };
  branch: string;
  date: string;
  time: string;
  guests: number;
  guestName: string;
  feedback: { rating: number; comment?: string } | null;
  open: boolean;
}

const RATING_WORDS = ["", "Poor", "Not great", "Good", "Very good", "Excellent"];

export default function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["feedback", token],
    queryFn: () => api.get<Visit>(`/api/public/feedback/${token}`),
    retry: false,
  });
  const visit = data?.data;

  const submit = useMutation({
    mutationFn: () =>
      api.post(`/api/public/feedback/${token}`, { rating, comment }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feedback", token] }),
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not send your feedback"
      ),
  });

  if (isLoading) {
    return (
      <div className="container max-w-xl py-16">
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="container max-w-xl py-20 text-center">
        <CalendarX className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Feedback link not valid</h1>
        <p className="mt-2 text-muted-foreground">
          Please use the link from your email exactly as it was sent.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/">Back to DineFlow</Link>
        </Button>
      </div>
    );
  }

  const when = `${formatDate(`${visit.date}T00:00:00Z`)} at ${formatTime(visit.time)}`;

  return (
    <div className="container max-w-xl space-y-6 py-12">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {visit.restaurant.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {visit.branch} · {when}
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-5 p-6">
          {visit.feedback ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <h2 className="text-lg font-semibold">Thank you for your feedback</h2>
              <StarRating value={visit.feedback.rating} className="justify-center" />
              {visit.feedback.comment && (
                <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
                  “{visit.feedback.comment}”
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                The team at {visit.restaurant.name} reads every review.
              </p>
            </div>
          ) : !visit.open ? (
            <p className="text-center text-sm text-muted-foreground">
              Feedback for this visit is closed. Thank you for dining with us.
            </p>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                if (rating === 0) {
                  toast.error("Pick a star rating first");
                  return;
                }
                submit.mutate();
              }}
            >
              <div className="space-y-2 text-center">
                <h2 className="text-lg font-semibold">
                  {visit.guestName ? `${visit.guestName.split(" ")[0]}, how` : "How"} was
                  your visit?
                </h2>
                <StarRating
                  value={rating}
                  onChange={setRating}
                  size="lg"
                  className="justify-center"
                />
                <p className="h-5 text-sm text-muted-foreground">
                  {RATING_WORDS[rating]}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comment">Anything you would like to tell them? (optional)</Label>
                <Textarea
                  id="comment"
                  rows={4}
                  maxLength={1000}
                  placeholder="The food, the service, the room…"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </div>

              <Button type="submit" className="w-full" loading={submit.isPending}>
                Send feedback
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <p className="flex justify-center gap-4 text-center text-sm text-muted-foreground">
        <Link href={`/r/${visit.restaurant.slug}`} className="hover:text-foreground">
          Book again at {visit.restaurant.name}
        </Link>
        <Link href="/account" className="hover:text-foreground">
          My bookings &amp; points
        </Link>
      </p>
    </div>
  );
}
