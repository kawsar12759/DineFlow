import { NextRequest } from "next/server";
import { Customer } from "@/models";
import { customerSchema } from "@/lib/validations";
import {
  ApiError,
  handleApiError,
  ok,
  paginated,
  parseBody,
  parsePagination,
  requireTenantSession,
  tenantFilter,
} from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const { searchParams } = request.nextUrl;
    const { page, limit, skip } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const sort = searchParams.get("sort") ?? "recent";

    const filter: Record<string, unknown> = { ...tenantFilter(ctx) };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const sortMap: Record<string, Record<string, 1 | -1>> = {
      recent: { createdAt: -1 },
      spend: { totalSpend: -1 },
      visits: { visitCount: -1 },
      name: { name: 1 },
    };

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .sort(sortMap[sort] ?? sortMap.recent)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter),
    ]);

    return paginated(customers, total, page, limit);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireTenantSession();
    const input = await parseBody(request, customerSchema);

    const existing = await Customer.findOne({
      email: input.email.toLowerCase(),
      ...tenantFilter(ctx),
    }).lean();

    if (existing) {
      throw new ApiError("A customer with this email already exists", 409);
    }

    const customer = await Customer.create({
      ...input,
      ...tenantFilter(ctx),
    });

    await trackEvent(ctx.restaurantId, "customer_created", {
      customerId: customer._id.toString(),
      source: "manual",
    });

    return ok(customer, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
