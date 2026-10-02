"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Armchair,
  Ban,
  CalendarCheck,
  Check,
  CheckCheck,
  MoreHorizontal,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import {
  RESERVATION_STATUSES,
  RESERVATION_STATUS_META,
  type ReservationStatus,
} from "@/lib/constants";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ReservationFormDialog } from "@/components/dashboard/reservations/reservation-form-dialog";

interface ReservationRecord {
  _id: string;
  branchId: { _id: string; name: string } | null;
  customerId: { _id: string; name: string; email: string; phone?: string } | null;
  date: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string;
  estimatedSpend?: number;
  createdAt: string;
}

const STATUS_ACTIONS: Partial<
  Record<
    ReservationStatus,
    { to: ReservationStatus; label: string; icon: typeof Check }[]
  >
> = {
  pending: [
    { to: "approved", label: "Approve", icon: Check },
    { to: "rejected", label: "Reject", icon: X },
    { to: "cancelled", label: "Cancel", icon: Ban },
  ],
  approved: [
    { to: "seated", label: "Mark seated", icon: Armchair },
    { to: "cancelled", label: "Cancel", icon: Ban },
  ],
  seated: [{ to: "completed", label: "Complete", icon: CheckCheck }],
};

const isStatus = (value: string | null): value is ReservationStatus =>
  RESERVATION_STATUSES.includes(value as ReservationStatus);

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [status, setStatus] = useState(
    isStatus(initialStatus) ? initialStatus : "all"
  );
  const [branchId, setBranchId] = useState("all");
  const [date, setDate] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);

  const { data: branchData } = useQuery({
    queryKey: ["branches", "", 1],
    queryFn: () => api.get<{ _id: string; name: string }[]>("/api/branches?limit=100"),
  });
  const branches = branchData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["reservations", status, branchId, date, page],
    queryFn: () =>
      api.get<ReservationRecord[]>(
        `/api/reservations?status=${status}&branchId=${branchId}&date=${date}&page=${page}`
      ),
    placeholderData: keepPreviousData,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ReservationStatus }) =>
      api.patch(`/api/reservations/${id}`, { status: to }),
    onSuccess: (_, variables) => {
      toast.success(
        `Reservation marked ${RESERVATION_STATUS_META[variables.to].label.toLowerCase()}`
      );
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-overview"] });
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Failed to update status"
      );
    },
  });

  const reservations = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters = status !== "all" || branchId !== "all" || date !== "";

  function clearFilters() {
    setStatus("all");
    setBranchId("all");
    setDate("");
    setPage(1);
  }

  const isUpdating = (id: string) =>
    statusMutation.isPending && statusMutation.variables?.id === id;

  // The usual next step is a visible button; the rest sit in the menu.
  function renderActions(reservation: ReservationRecord) {
    const actions = STATUS_ACTIONS[reservation.status] ?? [];
    if (actions.length === 0) return null;
    const [primary, ...rest] = actions;
    const updating = isUpdating(reservation._id);
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="outline"
          loading={updating}
          onClick={() =>
            statusMutation.mutate({ id: reservation._id, to: primary.to })
          }
        >
          {!updating && <primary.icon />}
          {primary.label}
        </Button>
        {rest.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`More actions for ${reservation.customerId?.name ?? "this guest"}`}
                disabled={updating}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {rest.map((action) => (
                <DropdownMenuItem
                  key={action.to}
                  onClick={() =>
                    statusMutation.mutate({ id: reservation._id, to: action.to })
                  }
                  className={
                    action.to === "rejected" || action.to === "cancelled"
                      ? "text-destructive focus:text-destructive"
                      : undefined
                  }
                >
                  <action.icon />
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Reservations"
        description="Approve, seat, and track every booking."
      >
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          New reservation
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Tabs
          value={status}
          onValueChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
          className="-mx-4 overflow-x-auto px-4 scrollbar-thin sm:mx-0 sm:px-0"
        >
          <TabsList aria-label="Filter by status" className="w-max">
            <TabsTrigger value="all">All</TabsTrigger>
            {RESERVATION_STATUSES.map((item) => (
              <TabsTrigger key={item} value={item}>
                {RESERVATION_STATUS_META[item].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap gap-3 lg:ml-auto">
          <Select
            value={branchId}
            onValueChange={(value) => {
              setBranchId(value);
              setPage(1);
            }}
          >
            <SelectTrigger aria-label="Branch" className="w-[calc(50%-0.375rem)] sm:w-40">
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
          <Input
            type="date"
            aria-label="Date"
            className="w-[calc(50%-0.375rem)] sm:w-40"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <RotateCcw className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : reservations.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={hasFilters ? "No reservations match these filters" : "No reservations yet"}
              description={
                hasFilters
                  ? "Try another status, branch, or date."
                  : "Bookings from your public page appear here. You can also add one by hand."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New reservation
                  </Button>
                )
              }
              className="m-6"
            />
          ) : (
            <>
              {/* Phones: one card per booking, so status and actions stay in view. */}
              <ul className="divide-y md:hidden">
                {reservations.map((reservation) => (
                  <li key={reservation._id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {reservation.customerId?.name ?? "Unknown guest"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(reservation.date)} · {formatTime(reservation.time)} ·{" "}
                          {reservation.guests} {reservation.guests === 1 ? "guest" : "guests"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {reservation.branchId?.name ?? "—"}
                          {reservation.customerId?.phone && (
                            <>
                              {" · "}
                              <a
                                href={`tel:${reservation.customerId.phone}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {reservation.customerId.phone}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={reservation.status} />
                    </div>
                    {reservation.specialRequests && (
                      <p className="rounded-md bg-muted px-3 py-2 text-xs italic text-muted-foreground">
                        “{reservation.specialRequests}”
                      </p>
                    )}
                    {renderActions(reservation)}
                  </li>
                ))}
              </ul>
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Est. spend</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => {
                    return (
                      <TableRow key={reservation._id}>
                        <TableCell>
                          <div className="font-medium">
                            {reservation.customerId?.name ?? "Unknown guest"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reservation.customerId?.email}
                          </div>
                          {reservation.specialRequests && (
                            <div className="mt-0.5 max-w-52 truncate text-xs italic text-muted-foreground">
                              “{reservation.specialRequests}”
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {reservation.branchId?.name ?? "—"}
                        </TableCell>
                        <TableCell>
                          <div>{formatDate(reservation.date)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(reservation.time)}
                          </div>
                        </TableCell>
                        <TableCell>{reservation.guests}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {reservation.estimatedSpend
                            ? formatCurrency(reservation.estimatedSpend)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={reservation.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {renderActions(reservation)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {pagination && (
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
        />
      )}

      <ReservationFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </>
  );
}
