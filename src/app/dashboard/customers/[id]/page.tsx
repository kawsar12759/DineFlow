"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck,
  CircleDollarSign,
  Footprints,
  Mail,
  Phone,
  StickyNote,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatTime, getInitials } from "@/lib/utils";
import type { ReservationStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerDetail {
  customer: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    totalSpend: number;
    visitCount: number;
    tags: string[];
    notes?: string;
    createdAt: string;
    visitHistory: {
      date: string;
      branchId?: { _id: string; name: string } | null;
      spend: number;
      guests: number;
    }[];
  };
  reservations: {
    _id: string;
    branchId: { name: string } | null;
    date: string;
    time: string;
    guests: number;
    status: ReservationStatus;
  }[];
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api.get<CustomerDetail>(`/api/customers/${id}`),
  });

  const customer = data?.data.customer;
  const reservations = data?.data.reservations ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={Footprints}
        title="Customer not found"
        description="This profile may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link href="/dashboard/customers">
              <ArrowLeft className="h-4 w-4" />
              Back to customers
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link href="/dashboard/customers">
          <ArrowLeft className="h-4 w-4" />
          Customers
        </Link>
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary/10 text-lg text-primary">
              {getInitials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{customer.name}</h1>
              {customer.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {customer.email}
              </span>
              {customer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {customer.phone}
                </span>
              )}
              <span>Customer since {formatDate(customer.createdAt)}</span>
            </div>
            {customer.notes && (
              <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
                <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {customer.notes}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Footprints className="h-4 w-4" />
              Total visits
            </div>
            <div className="mt-2 text-3xl font-semibold">{customer.visitCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CircleDollarSign className="h-4 w-4" />
              Lifetime spend
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {formatCurrency(customer.totalSpend)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarCheck className="h-4 w-4" />
              Avg. spend / visit
            </div>
            <div className="mt-2 text-3xl font-semibold">
              {customer.visitCount > 0
                ? formatCurrency(customer.totalSpend / customer.visitCount)
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Visit history</CardTitle>
            <CardDescription>Completed visits recorded for this guest</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {customer.visitHistory.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No visits recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...customer.visitHistory]
                    .sort(
                      (a, b) =>
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    )
                    .slice(0, 10)
                    .map((visit, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(visit.date)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {visit.branchId?.name ?? "—"}
                        </TableCell>
                        <TableCell>{visit.guests}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(visit.spend)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
            <CardDescription>Recent bookings by this guest</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {reservations.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">
                No reservations yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation._id}>
                      <TableCell>
                        <div>{formatDate(reservation.date)}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(reservation.time)}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {reservation.branchId?.name ?? "—"}
                      </TableCell>
                      <TableCell>{reservation.guests}</TableCell>
                      <TableCell>
                        <StatusBadge status={reservation.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
