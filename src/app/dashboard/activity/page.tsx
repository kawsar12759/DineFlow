"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CalendarX,
  Clock,
  History,
  Move,
  Settings2,
  UtensilsCrossed,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate, getInitials } from "@/lib/utils";

interface ActivityEntry {
  _id: string;
  actorName: string;
  action: string;
  summary: string;
  createdAt: string;
  branchId?: { _id: string; name: string } | null;
}

const ICONS: { match: string; icon: typeof History }[] = [
  { match: "reservation.moved", icon: Move },
  { match: "reservation.rescheduled", icon: Move },
  { match: "reservation.cancelled", icon: CalendarX },
  { match: "reservation.rejected", icon: CalendarX },
  { match: "reservation.no_show", icon: CalendarX },
  { match: "reservation", icon: CalendarCheck },
  { match: "waitlist", icon: Clock },
  { match: "settings", icon: Settings2 },
  { match: "table", icon: UtensilsCrossed },
];

function iconFor(action: string) {
  return ICONS.find((entry) => action.startsWith(entry.match))?.icon ?? History;
}

/** "14:32 · 25 Sep 2026" in Bangladesh time. */
function timestamp(iso: string) {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return `${time} · ${formatDate(iso)}`;
}

export default function ActivityPage() {
  const [action, setAction] = useState("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["activity", action, page],
    queryFn: () =>
      api.get<ActivityEntry[]>(
        `/api/activity?action=${action}&page=${page}&limit=20`
      ),
  });

  const entries = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Activity"
        description="Who changed what, newest first."
      />

      <Tabs
        value={action}
        onValueChange={(value) => {
          setAction(value);
          setPage(1);
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="reservation">Bookings</TabsTrigger>
          <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nothing recorded yet"
          description="Approvals, table moves, cancellations and settings changes appear here as your team works."
        />
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {entries.map((entry) => {
              const Icon = iconFor(entry.action);
              return (
                <div key={entry._id} className="flex items-start gap-3 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{entry.summary}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-medium text-primary">
                          {getInitials(entry.actorName)}
                        </span>
                        {entry.actorName}
                      </span>
                      <span>{timestamp(entry.createdAt)}</span>
                      {entry.branchId && (
                        <Badge variant="outline" className="text-[10px]">
                          {entry.branchId.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {pagination && pagination.totalPages > 1 && (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
