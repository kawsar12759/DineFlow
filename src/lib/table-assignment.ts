import { Types } from "mongoose";
import { Reservation, Table } from "@/models";
import { ACTIVE_RESERVATION_STATUSES } from "@/lib/constants";
import {
  freeTablesAt,
  pickTables,
  seatingsOverlap,
  type TableLike,
} from "@/lib/tables";

/** Active bookings at a branch on a day, with the tables they hold. */
async function bookingsOn(
  branchId: Types.ObjectId,
  date: Date,
  excludeReservationId?: Types.ObjectId
) {
  const bookings = await Reservation.find({
    branchId,
    date,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    ...(excludeReservationId ? { _id: { $ne: excludeReservationId } } : {}),
  })
    .select("time tableIds")
    .lean();

  return bookings.map((booking) => ({
    time: booking.time,
    tableIds: (booking.tableIds ?? []).map(String),
  }));
}

async function activeTables(branchId: Types.ObjectId): Promise<TableLike[]> {
  const tables = await Table.find({ branchId, isActive: true })
    .select("name seats zone")
    .lean();
  return tables.map((table) => ({
    _id: table._id.toString(),
    name: table.name,
    seats: table.seats,
    zone: table.zone,
  }));
}

export interface AssignmentResult {
  /** Tables to hold, empty when the branch does not use tables. */
  tableIds: Types.ObjectId[];
  /** True when the branch has tables but none fit this party. */
  noFit: boolean;
  usesTables: boolean;
}

/** Finds tables for a party. Branches without tables fall back to capacity. */
export async function assignTables({
  branchId,
  date,
  time,
  guests,
  duration,
  excludeReservationId,
}: {
  branchId: Types.ObjectId;
  date: Date;
  time: string;
  guests: number;
  duration: number;
  excludeReservationId?: Types.ObjectId;
}): Promise<AssignmentResult> {
  const tables = await activeTables(branchId);
  if (tables.length === 0) {
    return { tableIds: [], noFit: false, usesTables: false };
  }

  const bookings = await bookingsOn(branchId, date, excludeReservationId);
  const picked = pickTables(
    freeTablesAt(tables, bookings, time, duration),
    guests
  );

  return {
    tableIds: (picked ?? []).map((table) => new Types.ObjectId(table._id)),
    noFit: picked === null,
    usesTables: true,
  };
}

/**
 * Confirms the tables a just-inserted reservation holds are not already
 * taken by an earlier booking (ObjectId order, which concurrent requests
 * all see the same way). If they are, the booking is moved to other free
 * tables; when nothing fits it is deleted and false is returned.
 */
export async function claimTables(
  reservation: {
    _id: Types.ObjectId;
    branchId: Types.ObjectId;
    date: Date;
    time: string;
    guests: number;
    tableIds: Types.ObjectId[];
  },
  duration: number
) {
  if (reservation.tableIds.length === 0) return true;

  const earlier = await Reservation.find({
    branchId: reservation.branchId,
    date: reservation.date,
    status: { $in: ACTIVE_RESERVATION_STATUSES },
    _id: { $lt: reservation._id },
  })
    .select("time tableIds")
    .lean();

  const takenByEarlier = new Set(
    earlier
      .filter((booking) => seatingsOverlap(booking.time, reservation.time, duration))
      .flatMap((booking) => (booking.tableIds ?? []).map(String))
  );

  const clash = reservation.tableIds.some((id) =>
    takenByEarlier.has(id.toString())
  );
  if (!clash) return true;

  // Someone beat us to a table: try the ones still free.
  const tables = await activeTables(reservation.branchId);
  const stillFree = tables.filter(
    (table) => !takenByEarlier.has(String(table._id))
  );
  const bookings = await bookingsOn(
    reservation.branchId,
    reservation.date,
    reservation._id
  );
  const picked = pickTables(
    freeTablesAt(stillFree, bookings, reservation.time, duration),
    reservation.guests
  );

  if (!picked) {
    await Reservation.deleteOne({ _id: reservation._id });
    return false;
  }

  await Reservation.updateOne(
    { _id: reservation._id },
    { $set: { tableIds: picked.map((table) => new Types.ObjectId(table._id)) } }
  );
  return true;
}
