import { NextRequest } from "next/server";
import { Branch, WaitlistEntry } from "@/models";
import { waitlistSchema } from "@/lib/validations";
import {
  ApiError,
  assertBranchAccess,
  branchFilter,
  handleApiError,
  ok,
  parseBody,
  parseObjectId,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { dayKeyToDate, isDayKey, todayKey } from "@/lib/dates";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const branchId = searchParams.get("branchId");
    const date = searchParams.get("date") ?? todayKey();
    const status = searchParams.get("status");

    if (!isDayKey(date)) throw new ApiError("Invalid date", 400);

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      ...branchFilter(ctx),
      date: dayKeyToDate(date),
    };
    if (branchId && branchId !== "all") {
      assertBranchAccess(ctx, branchId);
      filter.branchId = parseObjectId(branchId, "branch id");
    }
    if (status && status !== "all") filter.status = status;

    const entries = await WaitlistEntry.find(filter)
      .sort({ createdAt: 1 })
      .lean();

    return ok(entries);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const input = await parseBody(request, waitlistSchema);

    assertBranchAccess(ctx, input.branchId);
    const branch = await Branch.findOne({
      _id: parseObjectId(input.branchId, "branch id"),
      ...tenantFilter(ctx),
    }).lean();
    if (!branch) throw new ApiError("Branch not found", 404);

    const entry = await WaitlistEntry.create({
      ...tenantFilter(ctx),
      branchId: branch._id,
      date: dayKeyToDate(input.date),
      name: input.name,
      phone: input.phone || undefined,
      guests: input.guests,
      quotedMinutes: input.quotedMinutes,
      notes: input.notes || undefined,
    });

    return ok(entry, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
