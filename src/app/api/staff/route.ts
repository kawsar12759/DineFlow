import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
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
import {
  INVITE_TTL_HOURS,
  issuePasswordToken,
  passwordLinkUrl,
} from "@/lib/password-tokens";
import { sendEmail } from "@/lib/email/send";
import { staffInviteEmail } from "@/lib/email/templates";
import { appOrigin } from "@/lib/email/booking-emails";
import { recordActivity } from "@/lib/activity";
import { Restaurant, User as UserModel } from "@/models";

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

    // No password given: set an unusable one and send an invite link.
    const invited = !input.password;
    const hashedPassword = await bcrypt.hash(
      input.password || randomBytes(32).toString("base64url"),
      12
    );

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

    let inviteSent = false;
    if (invited) {
      const [restaurant, inviter] = await Promise.all([
        Restaurant.findById(ctx.restaurantId).select("name").lean(),
        UserModel.findById(ctx.userId).select("name").lean(),
      ]);
      const { token } = await issuePasswordToken(
        member._id,
        "invite"
      );
      const template = staffInviteEmail({
        name: member.name,
        restaurantName: restaurant?.name ?? "your restaurant",
        inviterName: inviter?.name ?? "Your manager",
        roleLabel: input.role === "manager" ? "a manager" : "a staff member",
        url: passwordLinkUrl(token, appOrigin(request.nextUrl.origin)),
        expiresInHours: INVITE_TTL_HOURS,
      });
      const result = await sendEmail({ to: member.email, ...template });
      inviteSent = result.sent || result.provider === "console";
    }

    await recordActivity({
      restaurantId: ctx.restaurantId,
      actorId: ctx.userId,
      action: "staff.created",
      targetType: "user",
      targetId: member._id,
      summary: `Added ${member.name} as ${input.role}${invited ? " and sent an invite" : ""}`,
    });

    const { password: _password, ...safe } = member.toObject();
    return ok({ ...safe, invited, inviteSent }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
