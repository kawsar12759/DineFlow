"use client";

import { useState } from "react";
import { CalendarOff, Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DAYS_OF_WEEK, type OpeningHour } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { todayKey } from "@/lib/dates";

export interface ClosureValue {
  date: string;
  reason?: string;
}

// Bangladeshi weeks run Saturday to Friday.
const WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];

export function HoursEditor({
  hours,
  onChange,
}: {
  hours: OpeningHour[];
  onChange: (hours: OpeningHour[]) => void;
}) {
  const update = (day: number, patch: Partial<OpeningHour>) =>
    onChange(
      hours.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry))
    );

  const copyToAll = (day: number) => {
    const source = hours.find((entry) => entry.day === day);
    if (!source) return;
    onChange(
      hours.map((entry) => ({
        ...entry,
        open: source.open,
        close: source.close,
        closed: source.closed,
      }))
    );
  };

  return (
    <div className="space-y-2">
      {WEEK_ORDER.map((day) => {
        const entry = hours.find((h) => h.day === day);
        if (!entry) return null;
        return (
          <div
            key={day}
            className="flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap"
          >
            <span className="w-20 text-sm font-medium">
              {DAYS_OF_WEEK[day].slice(0, 3)}
            </span>

            <div className="flex items-center gap-2">
              <Switch
                id={`open-${day}`}
                checked={!entry.closed}
                onCheckedChange={(checked) =>
                  update(day, { closed: !checked })
                }
              />
              <Label htmlFor={`open-${day}`} className="text-xs text-muted-foreground">
                {entry.closed ? "Closed" : "Open"}
              </Label>
            </div>

            {!entry.closed && (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  aria-label={`${DAYS_OF_WEEK[day]} opening time`}
                  value={entry.open}
                  onChange={(event) => update(day, { open: event.target.value })}
                  className="w-32"
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="time"
                  aria-label={`${DAYS_OF_WEEK[day]} closing time`}
                  value={entry.close}
                  onChange={(event) => update(day, { close: event.target.value })}
                  className="w-32"
                />
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => copyToAll(day)}
              title="Apply these hours to every day"
            >
              <Copy className="h-3.5 w-3.5" />
              Apply to all
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export function ClosuresEditor({
  closures,
  onChange,
}: {
  closures: ClosureValue[];
  onChange: (closures: ClosureValue[]) => void;
}) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const add = () => {
    if (!date || closures.some((closure) => closure.date === date)) return;
    onChange(
      [...closures, { date, reason: reason.trim() || undefined }].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    );
    setDate("");
    setReason("");
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="closure-date" className="text-xs">
            Date
          </Label>
          <Input
            id="closure-date"
            type="date"
            min={todayKey()}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-44"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="closure-reason" className="text-xs">
            Reason (optional)
          </Label>
          <Input
            id="closure-reason"
            placeholder="Eid holiday, private event…"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <Button type="button" variant="outline" onClick={add} disabled={!date}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      {closures.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarOff className="h-4 w-4" />
          No closed dates. Bookings follow the weekly hours above.
        </p>
      ) : (
        <ul className="space-y-2">
          {closures.map((closure) => (
            <li
              key={closure.date}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
            >
              <span>
                {formatDate(`${closure.date}T00:00:00Z`)}
                {closure.reason && (
                  <span className="text-muted-foreground"> · {closure.reason}</span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove closure on ${closure.date}`}
                onClick={() =>
                  onChange(closures.filter((item) => item.date !== closure.date))
                }
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
