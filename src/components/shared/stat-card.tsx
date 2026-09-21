import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  delta?: number;
  deltaLabel?: string;
  hint?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  hint,
}: StatCardProps) {
  const isPositive = delta !== undefined && delta >= 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
            <Icon className="h-4 w-4 text-accent-foreground" />
          </div>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
        {delta !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                isPositive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3.5 w-3.5" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5" />
              )}
              {Math.abs(delta).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">{deltaLabel ?? "vs previous period"}</span>
          </div>
        )}
        {hint && delta === undefined && (
          <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
        <Skeleton className="mt-3 h-9 w-24" />
        <Skeleton className="mt-2 h-3.5 w-32" />
      </CardContent>
    </Card>
  );
}
