"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  MessageSquareHeart,
  MessageSquareReply,
  Star,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { api, ApiClientError, type ApiResponse } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import { StarRating } from "@/components/shared/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime } from "@/lib/utils";
import type { RatingSummary } from "@/lib/feedback";

interface FeedbackEntry {
  _id: string;
  rating: number;
  comment?: string;
  isPublic: boolean;
  createdAt: string;
  reply?: { body: string; repliedAt: string };
  customerId: { _id: string; name: string; email: string } | null;
  branchId: { _id: string; name: string } | null;
  reservationId: { date: string; time: string; guests: number } | null;
}

/** The list endpoint adds the rating summary next to the page of reviews. */
type FeedbackResponse = ApiResponse<FeedbackEntry[]> & { summary: RatingSummary };

export default function FeedbackPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canManage = ["super_admin", "owner", "manager"].includes(
    session?.user?.role ?? ""
  );

  const [branchId, setBranchId] = useState("all");
  const [days, setDays] = useState("90");
  const [rating, setRating] = useState("all");
  const [replied, setReplied] = useState("all");
  const [page, setPage] = useState(1);
  const [replyTo, setReplyTo] = useState<FeedbackEntry | null>(null);
  const [replyText, setReplyText] = useState("");

  const { data: branchData } = useQuery({
    queryKey: ["branches", "", 1],
    queryFn: () => api.get<{ _id: string; name: string }[]>("/api/branches?limit=100"),
  });
  const branches = branchData?.data ?? [];

  const query = new URLSearchParams({
    branchId,
    days: days === "all" ? "" : days,
    rating: rating === "all" ? "" : rating,
    replied: replied === "no" ? "no" : "",
    page: String(page),
    limit: "10",
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ["feedback", query],
    queryFn: () =>
      api.get<FeedbackEntry[]>(`/api/feedback?${query}`) as Promise<FeedbackResponse>,
  });
  const entries = data?.data ?? [];
  const summary = data?.summary;

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      api.patch(`/api/feedback/${id}`, patch),
    onSuccess: (_result, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      if (patch.reply !== undefined) {
        toast.success("Reply sent to the guest");
        setReplyTo(null);
      } else {
        toast.success(patch.isPublic ? "Shown on your public page" : "Hidden from your public page");
      }
    },
    onError: (error) =>
      toast.error(error instanceof ApiClientError ? error.message : "Could not update"),
  });

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };

  const positive = summary
    ? summary.distribution[3] + summary.distribution[4]
    : 0;
  const negative = summary
    ? summary.distribution[0] + summary.distribution[1]
    : 0;

  return (
    <>
      <PageHeader
        title="Feedback"
        description="What guests said after their visit. Replies are emailed to them."
      >
        <Select value={days} onValueChange={resetPage(setDays)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectContent>
        </Select>
        {branches.length > 1 && (
          <Select value={branchId} onValueChange={resetPage(setBranchId)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {!summary ? (
          Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              title="Average rating"
              value={summary.count > 0 ? `${summary.average.toFixed(1)} ★` : "—"}
              icon={Star}
              hint={`${summary.count} ${summary.count === 1 ? "review" : "reviews"}`}
            />
            <StatCard
              title="Happy guests"
              value={summary.count > 0 ? `${Math.round((positive / summary.count) * 100)}%` : "—"}
              icon={ThumbsUp}
              hint="Rated 4 or 5 stars"
            />
            <StatCard
              title="Unhappy guests"
              value={negative}
              icon={ThumbsDown}
              hint="Rated 1 or 2 stars"
            />
            <Card>
              <CardContent className="space-y-1 p-6">
                {[5, 4, 3, 2, 1].map((stars) => {
                  const count = summary.distribution[stars - 1];
                  const width = summary.count > 0 ? (count / summary.count) * 100 : 0;
                  return (
                    <button
                      key={stars}
                      type="button"
                      onClick={() => resetPage(setRating)(rating === String(stars) ? "all" : String(stars))}
                      className="flex w-full items-center gap-2 rounded text-xs hover:bg-muted"
                      aria-label={`Show ${stars}-star reviews`}
                    >
                      <span className="w-3 text-muted-foreground">{stars}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${width}%` }} />
                      </div>
                      <span className="w-6 text-right text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={rating} onValueChange={resetPage(setRating)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any rating</SelectItem>
            {[5, 4, 3, 2, 1].map((stars) => (
              <SelectItem key={stars} value={String(stars)}>
                {stars} {stars === 1 ? "star" : "stars"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={replied} onValueChange={resetPage(setReplied)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Replied or not</SelectItem>
            <SelectItem value="no">Needs a reply</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={MessageSquareHeart}
          title="No feedback here yet"
          description="After a bill is closed, the guest is emailed a link to rate their visit. Their reviews appear here."
        />
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry._id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StarRating value={entry.rating} />
                      {!entry.isPublic && (
                        <Badge variant="outline" className="text-[10px]">
                          Hidden
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm">
                      {entry.customerId ? (
                        <Link
                          href={`/dashboard/customers/${entry.customerId._id}`}
                          className="font-medium hover:text-primary"
                        >
                          {entry.customerId.name}
                        </Link>
                      ) : (
                        "Guest"
                      )}
                      <span className="text-muted-foreground">
                        {entry.branchId ? ` · ${entry.branchId.name}` : ""}
                        {entry.reservationId
                          ? ` · visited ${formatDate(entry.reservationId.date)} at ${formatTime(entry.reservationId.time)}, party of ${entry.reservationId.guests}`
                          : ""}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>

                {entry.comment ? (
                  <p className="text-sm leading-relaxed">“{entry.comment}”</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No comment left.</p>
                )}

                {entry.reply && (
                  <div className="rounded-lg bg-muted px-4 py-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Your reply · {formatDate(entry.reply.repliedAt)}
                    </p>
                    <p className="mt-1">{entry.reply.body}</p>
                  </div>
                )}

                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyTo(entry);
                        setReplyText(entry.reply?.body ?? "");
                      }}
                    >
                      <MessageSquareReply className="h-3.5 w-3.5" />
                      {entry.reply ? "Edit reply" : "Reply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={update.isPending}
                      onClick={() =>
                        update.mutate({ id: entry._id, patch: { isPublic: !entry.isPublic } })
                      }
                    >
                      {entry.isPublic ? (
                        <>
                          <EyeOff className="h-3.5 w-3.5" />
                          Hide from public page
                        </>
                      ) : (
                        <>
                          <Eye className="h-3.5 w-3.5" />
                          Show on public page
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data?.pagination && data.pagination.totalPages > 1 && (
        <PaginationControls
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          total={data.pagination.total}
          onPageChange={setPage}
        />
      )}

      <Dialog open={!!replyTo} onOpenChange={(open) => !open && setReplyTo(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Reply to {replyTo?.customerId?.name ?? "the guest"}
            </DialogTitle>
            <DialogDescription>
              {replyTo?.reply
                ? "Edits update the reply on your public page; the guest is not emailed again."
                : "The guest gets your reply by email, and it shows under their review on your public page."}
            </DialogDescription>
          </DialogHeader>
          {replyTo?.comment && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              “{replyTo.comment}”
            </p>
          )}
          <Textarea
            rows={5}
            maxLength={1000}
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder="Thank them, and tell them what you will do about it."
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReplyTo(null)}>
              Cancel
            </Button>
            <Button
              loading={update.isPending}
              disabled={replyText.trim().length < 2}
              onClick={() =>
                replyTo &&
                update.mutate({ id: replyTo._id, patch: { reply: replyText.trim() } })
              }
            >
              {replyTo?.reply ? "Save reply" : "Send reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
