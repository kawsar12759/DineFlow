"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { RESERVATION_STATUS_META, type ReservationStatus } from "@/lib/constants";
import { timeToMinutes } from "@/lib/dates";

export interface FloorTable {
  _id: string;
  name: string;
  seats: number;
  zone: string;
}

export interface FloorReservation {
  _id: string;
  time: string;
  guests: number;
  status: ReservationStatus;
  specialRequests?: string;
  tableIds: string[];
  customer: { _id: string; name: string; phone?: string; noShowCount?: number };
}

const STATUS_BLOCK: Record<ReservationStatus, string> = {
  pending: "bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200",
  approved: "bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-200",
  seated: "bg-sky-100 border-sky-300 text-sky-900 hover:bg-sky-200",
  completed: "bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200",
  cancelled: "bg-slate-50 border-slate-200 text-slate-400 line-through",
  rejected: "bg-red-50 border-red-200 text-red-700 line-through",
  no_show: "bg-orange-100 border-orange-300 text-orange-900",
};

/** Bookings that still hold their tables. */
const HOLDS_TABLE: ReservationStatus[] = ["pending", "approved", "seated"];

export function FloorTimeline({
  tables,
  reservations,
  slots,
  slotInterval,
  duration,
  onSelect,
  onMove,
}: {
  tables: FloorTable[];
  reservations: FloorReservation[];
  slots: string[];
  slotInterval: number;
  duration: number;
  onSelect: (reservation: FloorReservation) => void;
  onMove: (reservationId: string, tableId: string) => void;
}) {
  // The id lives in a ref so the drop handler always sees the current drag,
  // even before React has re-rendered; state drives the highlight only.
  const draggingRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const startDrag = (id: string) => {
    draggingRef.current = id;
    setDragging(id);
  };

  const endDrag = () => {
    draggingRef.current = null;
    setDragging(null);
    setDropTarget(null);
  };

  const span = Math.max(1, Math.round(duration / slotInterval));
  const zones = [...new Set(tables.map((table) => table.zone))];

  const columnStart = (time: string) => {
    const index = slots.indexOf(time);
    if (index >= 0) return index + 2;
    // A booking outside the bookable range (e.g. hours changed later):
    // place it at the nearest slot so it stays visible.
    const minutes = timeToMinutes(time);
    const nearest = slots.findIndex((slot) => timeToMinutes(slot) >= minutes);
    return (nearest === -1 ? slots.length - 1 : nearest) + 2;
  };

  const gridStyle = {
    gridTemplateColumns: `10rem repeat(${slots.length}, minmax(4.5rem, 1fr))`,
  };

  return (
    <div className="overflow-x-auto rounded-xl border bg-card scrollbar-thin">
      <div className="min-w-max">
        {/* Times */}
        <div
          className="sticky top-0 z-10 grid border-b bg-card/95 backdrop-blur"
          style={gridStyle}
        >
          <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
            Table
          </div>
          {slots.map((slot) => (
            <div
              key={slot}
              className="border-l px-1 py-2 text-center text-xs text-muted-foreground"
            >
              {formatTime(slot)}
            </div>
          ))}
        </div>

        {zones.map((zone) => (
          <div key={zone}>
            <div className="border-b bg-muted/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {zone}
            </div>

            {tables
              .filter((table) => table.zone === zone)
              .map((table) => {
                const seated = reservations.filter(
                  (reservation) =>
                    reservation.tableIds.includes(table._id) &&
                    HOLDS_TABLE.includes(reservation.status)
                );

                return (
                  <div
                    key={table._id}
                    className={cn(
                      "grid border-b transition-colors",
                      dropTarget === table._id && "bg-primary/10"
                    )}
                    style={gridStyle}
                    onDragOver={(event) => {
                      if (!draggingRef.current) return;
                      event.preventDefault();
                      setDropTarget(table._id);
                    }}
                    onDragLeave={() =>
                      setDropTarget((current) =>
                        current === table._id ? null : current
                      )
                    }
                    onDrop={(event) => {
                      event.preventDefault();
                      const id = draggingRef.current;
                      if (id) onMove(id, table._id);
                      endDrag();
                    }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2">
                      <span className="font-medium">{table.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {table.seats}
                      </span>
                    </div>

                    {/* Empty cells give the row its height and grid lines. */}
                    {slots.map((slot) => (
                      <div key={slot} className="min-h-[2.75rem] border-l" />
                    ))}

                    {seated.map((reservation) => (
                      <button
                        key={reservation._id}
                        type="button"
                        draggable
                        onDragStart={() => startDrag(reservation._id)}
                        onDragEnd={endDrag}
                        onClick={() => onSelect(reservation)}
                        style={{
                          gridRow: 1,
                          gridColumnStart: columnStart(reservation.time),
                          gridColumnEnd: `span ${span}`,
                        }}
                        className={cn(
                          "m-1 flex cursor-grab items-center gap-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs transition-colors active:cursor-grabbing",
                          STATUS_BLOCK[reservation.status],
                          dragging === reservation._id && "opacity-50"
                        )}
                        title={`${reservation.customer.name} · ${reservation.guests} guests · ${RESERVATION_STATUS_META[reservation.status].label}`}
                      >
                        <span className="truncate font-medium">
                          {reservation.customer.name}
                        </span>
                        <span className="shrink-0 opacity-70">
                          ({reservation.guests})
                        </span>
                        {reservation.specialRequests && (
                          <AlertTriangle className="h-3 w-3 shrink-0 opacity-70" />
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
