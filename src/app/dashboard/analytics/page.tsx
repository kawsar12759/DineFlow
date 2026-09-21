"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Eye, TrendingUp } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CustomerGrowthChart,
  ReservationTrendChart,
  RevenueTrendChart,
  type TrendPoint,
} from "@/components/dashboard/trend-charts";
import {
  BranchRevenueChart,
  CategoryDistributionChart,
  type BranchPerformance,
  type CategoryStat,
} from "@/components/dashboard/analytics/analytics-charts";

interface MenuAnalytics {
  topViewed: {
    _id: string;
    name: string;
    category: string;
    price: number;
    views: number;
  }[];
  categories: CategoryStat[];
  topByScore: {
    _id: string;
    name: string;
    category: string;
    price: number;
    popularityScore: number;
    availability: boolean;
  }[];
}

export default function AnalyticsPage() {
  const [range, setRange] = useState("30");

  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ["analytics-trends", range],
    queryFn: () =>
      api.get<{ series: TrendPoint[] }>(`/api/analytics/trends?days=${range}`),
  });

  const { data: branchData, isLoading: branchesLoading } = useQuery({
    queryKey: ["analytics-branches"],
    queryFn: () => api.get<BranchPerformance[]>("/api/analytics/branches"),
  });

  const { data: menuData, isLoading: menuLoading } = useQuery({
    queryKey: ["analytics-menu"],
    queryFn: () => api.get<MenuAnalytics>("/api/analytics/menu"),
  });

  const series = trendsData?.data.series ?? [];
  const branches = branchData?.data ?? [];
  const menu = menuData?.data;

  const totalRevenue = series.reduce((sum, point) => sum + point.revenue, 0);
  const totalReservations = series.reduce(
    (sum, point) => sum + point.reservations,
    0
  );
  const totalNewCustomers = series.reduce(
    (sum, point) => sum + point.newCustomers,
    0
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Deep-dive into revenue, reservations, branches, and menu performance."
      >
        <Tabs value={range} onValueChange={setRange}>
          <TabsList>
            <TabsTrigger value="7">7d</TabsTrigger>
            <TabsTrigger value="30">30d</TabsTrigger>
            <TabsTrigger value="90">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {/* Summary strip */}
      <div className="grid gap-4 sm:grid-cols-3">
        {trendsLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24" />
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Revenue (last {range}d)
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatCurrency(totalRevenue)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  Reservations (last {range}d)
                </p>
                <p className="mt-1 text-2xl font-semibold">{totalReservations}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">
                  New customers (last {range}d)
                </p>
                <p className="mt-1 text-2xl font-semibold">{totalNewCustomers}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="menu">Menu</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue over time</CardTitle>
              <CardDescription>
                Daily revenue from completed reservations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <Skeleton className="h-[280px] w-full" />
              ) : (
                <RevenueTrendChart data={series} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reservations" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Reservation volume</CardTitle>
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
        </TabsContent>

        <TabsContent value="customers" className="mt-4">
          <Card>
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
        </TabsContent>

        <TabsContent value="branches" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by branch</CardTitle>
                <CardDescription>Last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                {branchesLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : branches.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No branch data"
                    description="Create branches and complete reservations to see performance."
                  />
                ) : (
                  <BranchRevenueChart data={branches} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Branch leaderboard</CardTitle>
                <CardDescription>
                  Reservations, covers, and utilization (30d)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {branchesLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead>Bookings</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Utilization</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {branches.map((branch) => (
                        <TableRow key={branch._id}>
                          <TableCell>
                            <div className="font-medium">{branch.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {branch.city}
                            </div>
                          </TableCell>
                          <TableCell>{branch.reservations}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(branch.revenue)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{ width: `${branch.utilization}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {branch.utilization}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="menu" className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Category distribution</CardTitle>
                <CardDescription>Menu items per category</CardDescription>
              </CardHeader>
              <CardContent>
                {menuLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : !menu || menu.categories.length === 0 ? (
                  <EmptyState
                    icon={BarChart3}
                    title="No menu data"
                    description="Add menu items to see category analytics."
                  />
                ) : (
                  <CategoryDistributionChart data={menu.categories} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Most viewed dishes
                </CardTitle>
                <CardDescription>
                  Public menu views over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {menuLoading ? (
                  <div className="space-y-3 p-6">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Skeleton key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : !menu || menu.topViewed.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted-foreground">
                    No view events recorded yet. Views are tracked from the
                    public menu page.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Dish</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Views</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {menu.topViewed.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{item.category}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                              {item.views}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
