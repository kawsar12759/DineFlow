"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Five stars. Read-only by default; pass `onChange` to let people pick a
 * rating (keyboard: the stars are ordinary radio-like buttons).
 */
export function StarRating({
  value,
  onChange,
  size = "sm",
  className,
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: "sm" | "lg";
  className?: string;
}) {
  const iconClass = size === "lg" ? "h-9 w-9" : "h-4 w-4";

  if (!onChange) {
    return (
      <div
        className={cn("flex items-center gap-0.5", className)}
        role="img"
        aria-label={`${value} out of 5 stars`}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              iconClass,
              star <= Math.round(value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          onClick={() => onChange(star)}
          className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              iconClass,
              star <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/40"
            )}
          />
        </button>
      ))}
    </div>
  );
}
