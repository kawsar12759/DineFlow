import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError, type ZodSchema } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { DASHBOARD_ROLES, PAGE_SIZE, type Role } from "@/lib/constants";

import { ApiError } from "@/lib/api-error";

export { ApiError };

export interface SessionContext {
  userId: string;
  role: Role;
  restaurantId: string;
  branchId?: string;
  /** Set when the user may only see one branch (branch-assigned staff). */
  branchScope?: string;
}

/**
 * Loads the signed-in user's current record. The JWT alone is not trusted
 * for authorisation, so deactivation, role changes and branch reassignment
 * take effect on the next request instead of when the token expires.
 */
export async function loadActiveUser(userId: string) {
  if (!Types.ObjectId.isValid(userId)) return null;
  await connectDB();
  const user = await User.findById(userId)
    .select("name email role restaurantId branchId isActive")
    .lean();
  return user?.isActive ? user : null;
}

/**
 * Resolves the authenticated session and enforces tenant context.
 * Every dashboard API route MUST go through this — it guarantees a
 * restaurantId is present so queries can never be unscoped.
 */
export async function requireTenantSession(
  allowedRoles: Role[] = DASHBOARD_ROLES
): Promise<SessionContext> {
  const session = await auth();

  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }

  const user = await loadActiveUser(session.user.id);
  if (!user) {
    throw new ApiError("Your account is inactive or no longer exists", 401);
  }

  if (!allowedRoles.includes(user.role)) {
    throw new ApiError("Forbidden: insufficient permissions", 403);
  }

  if (!user.restaurantId) {
    throw new ApiError("Forbidden: no restaurant context", 403);
  }

  const branchId = user.branchId?.toString();

  return {
    userId: user._id.toString(),
    role: user.role,
    restaurantId: user.restaurantId.toString(),
    branchId,
    branchScope: user.role === "staff" ? branchId : undefined,
  };
}

/** Tenant filter every query must spread into its conditions. */
export function tenantFilter(ctx: SessionContext) {
  return { restaurantId: new Types.ObjectId(ctx.restaurantId) };
}

/** Branch filter for branch-scoped users; empty for restaurant-wide roles. */
export function branchFilter(ctx: SessionContext, field = "branchId") {
  return ctx.branchScope
    ? { [field]: new Types.ObjectId(ctx.branchScope) }
    : {};
}

/** Throws 403 when a branch-scoped user touches another branch. */
export function assertBranchAccess(
  ctx: SessionContext,
  branchId: Types.ObjectId | string | undefined | null
) {
  if (ctx.branchScope && String(branchId) !== ctx.branchScope) {
    throw new ApiError("Forbidden: this belongs to another branch", 403);
  }
}

export function parseObjectId(value: string, label = "id") {
  if (!Types.ObjectId.isValid(value)) {
    throw new ApiError(`Invalid ${label}`, 400);
  }
  return new Types.ObjectId(value);
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit")) || PAGE_SIZE)
  );
  return { page, limit, skip: (page - 1) * limit };
}

export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
  return schema.parse(json);
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.status }
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        issues: error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 422 }
    );
  }

  console.error("[API ERROR]", error);
  return NextResponse.json(
    { success: false, error: "Internal server error" },
    { status: 500 }
  );
}
