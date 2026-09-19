import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError, type ZodSchema } from "zod";
import { auth } from "@/auth";
import { connectDB } from "@/lib/db";
import { DASHBOARD_ROLES, PAGE_SIZE, type Role } from "@/lib/constants";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface SessionContext {
  userId: string;
  role: Role;
  restaurantId: string;
  branchId?: string;
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

  const { id, role, restaurantId, branchId } = session.user;

  if (!allowedRoles.includes(role)) {
    throw new ApiError("Forbidden: insufficient permissions", 403);
  }

  if (!restaurantId) {
    throw new ApiError("Forbidden: no restaurant context", 403);
  }

  await connectDB();

  return { userId: id, role, restaurantId, branchId };
}

/** Tenant filter every query must spread into its conditions. */
export function tenantFilter(ctx: SessionContext) {
  return { restaurantId: new Types.ObjectId(ctx.restaurantId) };
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
