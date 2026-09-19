import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, Restaurant } from "@/models";
import { registerSchema } from "@/lib/validations";
import { handleApiError, ok, parseBody, ApiError } from "@/lib/api-helpers";
import { trackEvent } from "@/lib/analytics";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Registers a new restaurant owner. Creates the User and their
 * Restaurant tenant in one flow, then links them together.
 */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, registerSchema);

    await connectDB();

    const existing = await User.findOne({ email: input.email }).lean();
    if (existing) {
      throw new ApiError("An account with this email already exists", 409);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await User.create({
      name: input.name,
      email: input.email,
      password: hashedPassword,
      role: "owner",
    });

    let slug = slugify(input.restaurantName);
    const slugTaken = await Restaurant.findOne({ slug }).lean();
    if (slugTaken) {
      slug = `${slug}-${user._id.toString().slice(-6)}`;
    }

    const restaurant = await Restaurant.create({
      name: input.restaurantName,
      slug,
      ownerId: user._id,
      subscriptionPlan: "starter",
    });

    user.restaurantId = restaurant._id;
    await user.save();

    await trackEvent(restaurant._id, "system", {
      action: "restaurant_registered",
      restaurantName: restaurant.name,
    });

    return ok(
      {
        id: user._id.toString(),
        email: user.email,
        restaurantId: restaurant._id.toString(),
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
