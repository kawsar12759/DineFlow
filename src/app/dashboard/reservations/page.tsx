"use client";

import { useState } from "react";
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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import {
  RESERVATION_STATUSES,
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

export default function ReservationsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");
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
      toast.success(`Reservation ${variables.to}`);
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
          className="overflow-x-auto"
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {RESERVATION_STATUSES.map((item) => (
              <TabsTrigger key={item} value={item} className="capitalize">
                {item}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-3 lg:ml-auto">
          <Select
            value={branchId}
            onValueChange={(value) => {
              setBranchId(value);
              setPage(1);
            }}
          >
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
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setPage(1);
            }}
          />
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
              title="No reservations found"
              description="Adjust the filters or create a booking manually."
              className="m-6"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guest</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Est. spend</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => {
                  const actions = STATUS_ACTIONS[reservation.status] ?? [];
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
                      <TableCell>
                        {actions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Move to</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {actions.map((action) => (
                                <DropdownMenuItem
                                  key={action.to}
                                  onClick={() =>
                                    statusMutation.mutate({
                                      id: reservation._id,
                                      to: action.to,
                                    })
                                  }
                                >
                                  <action.icon />
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
