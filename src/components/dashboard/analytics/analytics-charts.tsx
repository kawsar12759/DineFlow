"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactCurrency, formatCurrency } from "@/lib/utils";

const CHART_COLORS = [
  "hsl(161 84% 32%)",
  "hsl(199 89% 48%)",
  "hsl(38 92% 50%)",
  "hsl(262 70% 58%)",
  "hsl(340 75% 55%)",
  "hsl(20 90% 55%)",
];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
  boxShadow: "0 4px 12px rgb(0 0 0 / 0.08)",
};

export interface BranchPerformance {
  _id: string;
  name: string;
  city?: string;
  capacity: number;
  reservations: number;
  completed: number;
  revenue: number;
  covers: number;
  utilization: number;
}

export function BranchRevenueChart({ data }: { data: BranchPerformance[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, bottom: 0, left: 24 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatCompactCurrency(Number(value))}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [formatCurrency(Number(value)), "Revenue (30d)"]}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface CategoryStat {
  category: string;
  count: number;
  available: number;
  avgPrice: number;
}

export function CategoryDistributionChart({ data }: { data: CategoryStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="category"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span style={{ fontSize: 12, color: "hsl(224 12% 46%)" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
