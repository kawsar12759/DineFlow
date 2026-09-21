import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { User } from "@/models";
import { staffSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  paginated,
  parseBody,
  parseObjectId,
  parsePagination,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const role = searchParams.get("role");

    const filter: Record<string, unknown> = {
      ...tenantFilter(ctx),
      role: { $in: ["manager", "staff"] },
    };
    if (role && role !== "all") filter.role = role;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const [staff, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("branchId", "name")
        .lean(),
      User.countDocuments(filter),
    ]);

    return paginated(staff, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession(["super_admin", "owner", "manager"]);
    const input = await parseBody(request, staffSchema);

    // Managers cannot create other managers — only owners can.
    if (ctx.role === "manager" && input.role === "manager") {
      throw new ApiError("Managers can only create staff accounts", 403);
    }

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      throw new ApiError("An account with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const member = await User.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: input.role,
      shift: input.shift,
      position: input.position,
      phone: input.phone,
      ...(input.branchId
        ? { branchId: parseObjectId(input.branchId, "branch id") }
        : {}),
      ...tenantFilter(ctx),
    });

    const { password: _password, ...safe } = member.toObject();
    return ok(safe, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
