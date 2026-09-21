"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";

export interface TrendPoint {
  date: string;
  reservations: number;
  completed: number;
  cancelled: number;
  revenue: number;
  covers: number;
  newCustomers: number;
}

function formatAxisDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(220 14% 90%)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
};

export function ReservationTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="reservationsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(161 84% 32%)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="hsl(161 84% 32%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 14% 92%)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(value) => formatAxisDate(String(value))}
        />
        <Area
          type="monotone"
          dataKey="reservations"
          name="Reservations"
          stroke="hsl(161 84% 32%)"
          strokeWidth={2}
          fill="url(#reservationsFill)"
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke="hsl(199 89% 48%)"
          strokeWidth={2}
          fill="transparent"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function RevenueTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 14% 92%)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${formatCompactNumber(Number(value))}`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(value) => formatAxisDate(String(value))}
          formatter={(value, name) =>
            name === "Revenue"
              ? [formatCurrency(Number(value)), name]
              : [value, name]
          }
        />
        <Bar
          dataKey="revenue"
          name="Revenue"
          fill="hsl(161 84% 32%)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CustomerGrowthChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(220 14% 92%)" />
        <XAxis
          dataKey="date"
          tickFormatter={formatAxisDate}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(value) => formatAxisDate(String(value))}
        />
        <Line
          type="monotone"
          dataKey="newCustomers"
          name="New customers"
          stroke="hsl(262 70% 58%)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
