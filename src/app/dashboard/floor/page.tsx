"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarOff,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  UserPlus,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/api-client";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FloorTimeline,
  type FloorReservation,
  type FloorTable,
} from "@/components/dashboard/floor/floor-timeline";
import { ReservationDetailDialog } from "@/components/dashboard/floor/reservation-detail-dialog";
import { WalkInDialog } from "@/components/dashboard/floor/walk-in-dialog";
import { WaitlistPanel } from "@/components/dashboard/floor/waitlist-panel";
import { addDaysToKey, todayKey } from "@/lib/dates";
import { formatDate, formatTime } from "@/lib/utils";
import type { BookingSettings } from "@/lib/constants";

interface FloorData {
  date: string;
  branch: { _id: string; name: string; capacity: number; hours: string };
  settings: BookingSettings;
  closed: boolean;
  slots: string[];
  tables: FloorTable[];
  reservations: FloorReservation[];
}

interface BranchOption {
  _id: string;
  name: string;
}

export default function FloorPage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayKey());
  const [branchId, setBranchId] = useState("");
  const [selected, setSelected] = useState<FloorReservation | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const { data: branchData } = useQuery({
    queryKey: ["branches", "all"],
    queryFn: () => api.get<BranchOption[]>("/api/branches?limit=100"),
  });
  const branches = branchData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["floor", branchId, date],
    queryFn: () =>
      api.get<FloorData>(
        `/api/floor?date=${date}${branchId ? `&branchId=${branchId}` : ""}`
      ),
    // Keep the floor fresh while service is running.
    refetchInterval: 60_000,
  });
  const floor = data?.data;

  const move = useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: string }) =>
      api.patch(`/api/reservations/${id}`, { tableIds: [tableId] }),
    onSuccess: () => {
      toast.success("Moved to another table");
      queryClient.invalidateQueries({ queryKey: ["floor"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not move booking"
      ),
  });

  const holding = (floor?.reservations ?? []).filter((reservation) =>
    ["pending", "approved", "seated"].includes(reservation.status)
  );
  const unassigned = holding.filter(
    (reservation) => reservation.tableIds.length === 0
  );
  const covers = holding.reduce((sum, item) => sum + item.guests, 0);
  const seatedNow = holding.filter((item) => item.status === "seated").length;
  const pending = holding.filter((item) => item.status === "pending").length;

  return (
    <>
      <PageHeader
        title="Floor"
        description="Who is sitting where, all day, for one branch."
      >
        <Button onClick={() => setWalkInOpen(true)} disabled={!floor}>
          <UserPlus className="h-4 w-4" />
          Walk-in
        </Button>
      </PageHeader>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {branches.length > 1 && (
          <Select
            value={branchId || floor?.branch._id || ""}
            onValueChange={setBranchId}
          >
            <SelectTrigger className="w-full sm:w-56" aria-label="Branch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch._id} value={branch._id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous day"
            onClick={() => setDate(addDaysToKey(date, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-44"
            aria-label="Date"
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Next day"
            onClick={() => setDate(addDaysToKey(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {date !== todayKey() && (
            <Button variant="ghost" size="sm" onClick={() => setDate(todayKey())}>
              Today
            </Button>
          )}
        </div>

        {floor && (
          <p className="text-sm text-muted-foreground">
            {formatDate(`${floor.date}T00:00:00Z`)} · {holding.length} bookings ·{" "}
            {covers} covers · {seatedNow} seated
            {pending > 0 && ` · ${pending} awaiting approval`}
          </p>
        )}
      </div>

      {isLoading || !floor ? (
        <Skeleton className="h-96 w-full" />
      ) : floor.closed ? (
        <EmptyState
          icon={CalendarOff}
          title={`${floor.branch.name} is closed on this date`}
          description={`Opening hours: ${floor.branch.hours || "not set"}.`}
        />
      ) : floor.tables.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No tables at this branch yet"
          description="Add tables to see the floor. Until then, bookings are limited by total seats only."
        />
      ) : (
        <>
          {unassigned.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <h2 className="text-sm font-medium">
                  Not seated yet ({unassigned.length})
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {unassigned.map((reservation) => (
                    <Button
                      key={reservation._id}
                      variant="outline"
                      size="sm"
                      onClick={() => setSelected(reservation)}
                    >
                      {formatTime(reservation.time)} · {reservation.customer.name} (
                      {reservation.guests})
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <FloorTimeline
            tables={floor.tables}
            reservations={floor.reservations}
            slots={floor.slots}
            slotInterval={floor.settings.slotIntervalMinutes}
            duration={floor.settings.diningDurationMinutes}
            onSelect={setSelected}
            onMove={(id, tableId) => move.mutate({ id, tableId })}
          />

          <WaitlistPanel branchId={floor.branch._id} date={floor.date} />
        </>
      )}

      <ReservationDetailDialog
        reservation={selected}
        tables={floor?.tables ?? []}
        slots={floor?.slots ?? []}
        onOpenChange={(open) => !open && setSelected(null)}
      />

      {floor && (
        <WalkInDialog
          open={walkInOpen}
          onOpenChange={setWalkInOpen}
          branchId={floor.branch._id}
          date={floor.date}
          slots={floor.slots}
        />
      )}
    </>
  );
}
