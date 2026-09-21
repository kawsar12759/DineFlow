"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarCheck,
  CircleDollarSign,
  Gauge,
  Hourglass,
  Store,
  Users,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard, StatCardSkeleton } from "@/components/shared/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CustomerGrowthChart,
  ReservationTrendChart,
  RevenueTrendChart,
  type TrendPoint,
} from "@/components/dashboard/trend-charts";

interface Overview {
  todaysReservations: number;
  reservationsDelta: number;
  revenue: number;
  revenueDelta: number;
  occupancyRate: number;
  guestsToday: number;
  totalCapacity: number;
  popularBranches: { _id: string; name: string; count: number }[];
  activeCustomers: number;
  totalCustomers: number;
  pendingReservations: number;
}

export default function DashboardOverviewPage() {
  const [range, setRange] = useState("30");

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["analytics-overview"],
    queryFn: () => api.get<Overview>("/api/analytics/overview"),
  });

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics-trends", range],
    queryFn: () =>
      api.get<{ days: number; series: TrendPoint[] }>(
        `/api/analytics/trends?days=${range}`
      ),
  });

  const overview = overviewData?.data;
  const series = trendsData?.data.series ?? [];

  return (
    <>
      <PageHeader
        title="Overview"
        description="What's happening across your restaurant today."
      >
        <Tabs value={range} onValueChange={setRange}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* Stat widgets */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewLoading || !overview ? (
          Array.from({ length: 4 }).map((_, index) => (
            <StatCardSkeleton key={index} />
          ))
        ) : (
          <>
            <StatCard
              title="Today's reservations"
              value={overview.todaysReservations}
              icon={CalendarCheck}
              delta={overview.reservationsDelta}
              deltaLabel="vs yesterday"
            />
            <StatCard
              title="Revenue (this month)"
              value={formatCurrency(overview.revenue)}
              icon={CircleDollarSign}
              delta={overview.revenueDelta}
              deltaLabel="vs last month"
            />
            <StatCard
              title="Occupancy today"
              value={`${overview.occupancyRate}%`}
              icon={Gauge}
              hint={`${overview.guestsToday} guests / ${overview.totalCapacity} seats`}
            />
            <StatCard
              title="Active customers"
              value={overview.activeCustomers}
              icon={Users}
              hint={`${overview.totalCustomers} total profiles`}
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Reservation trends</CardTitle>
            <CardDescription>Total vs completed bookings per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <ReservationTrendChart data={series} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue trends</CardTitle>
            <CardDescription>Completed reservation revenue per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <RevenueTrendChart data={series} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Customer growth</CardTitle>
            <CardDescription>New customer profiles per day</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (
              <CustomerGrowthChart data={series} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Hourglass className="h-4 w-4 text-amber-500" />
                Pending approvals
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overviewLoading || !overview ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-semibold">
                    {overview.pendingReservations}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    reservations waiting for a decision
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="h-4 w-4 text-primary" />
                Busiest branches
              </CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {overviewLoading || !overview ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-5 w-full" />
                  ))}
                </div>
              ) : overview.popularBranches.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No reservation activity yet.
                </p>
              ) : (
                <ul className="space-y-3">
                  {overview.popularBranches.map((branch, index) => (
                    <li
                      key={branch._id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-medium">
                          {index + 1}
                        </span>
                        {branch.name}
                      </span>
                      <span className="font-medium">{branch.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
