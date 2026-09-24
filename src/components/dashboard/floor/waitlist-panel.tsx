"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, LogOut, Phone, Utensils } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";

interface WaitlistEntry {
  _id: string;
  name: string;
  phone?: string;
  guests: number;
  quotedMinutes?: number;
  notes?: string;
  status: "waiting" | "seated" | "left";
  createdAt: string;
}

/** Whole minutes a party has been waiting. */
function waitedMinutes(since: string) {
  return Math.max(0, Math.round((Date.now() - new Date(since).getTime()) / 60_000));
}

export function WaitlistPanel({
  branchId,
  date,
}: {
  branchId: string;
  date: string;
}) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["waitlist", branchId, date],
    queryFn: () =>
      api.get<WaitlistEntry[]>(
        `/api/waitlist?branchId=${branchId}&date=${date}&status=waiting`
      ),
    refetchInterval: 60_000,
  });
  const entries = data?.data ?? [];

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "seated" | "left" }) =>
      api.patch(`/api/waitlist/${id}`, { status }),
    onSuccess: (_result, variables) => {
      toast.success(
        variables.status === "seated" ? "Party seated" : "Removed from waitlist"
      );
      queryClient.invalidateQueries({ queryKey: ["waitlist"] });
      queryClient.invalidateQueries({ queryKey: ["floor"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not update"
      ),
  });

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (entries.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-amber-500" />
          Waitlist ({entries.length})
        </CardTitle>
        <CardDescription>
          Parties waiting for a table. Seating one puts it on the first free table.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.map((entry) => (
          <div
            key={entry._id}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{entry.name}</span>
                <Badge variant="secondary">
                  {entry.guests} {entry.guests === 1 ? "guest" : "guests"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  waiting {waitedMinutes(entry.createdAt)} min
                  {entry.quotedMinutes != null &&
                    ` · quoted ${entry.quotedMinutes} min`}
                </span>
              </div>
              {entry.phone && (
                <a
                  href={`tel:${entry.phone}`}
                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Phone className="h-3 w-3" />
                  {entry.phone}
                </a>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                loading={update.isPending}
                onClick={() => update.mutate({ id: entry._id, status: "seated" })}
              >
                <Utensils className="h-4 w-4" />
                Seat
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => update.mutate({ id: entry._id, status: "left" })}
              >
                <LogOut className="h-4 w-4" />
                Left
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
