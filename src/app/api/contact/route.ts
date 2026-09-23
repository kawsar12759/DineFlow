import { connectDB } from "@/lib/db";
import { ContactMessage } from "@/models";
import { contactSchema } from "@/lib/validations";
import { handleApiError, ok, parseBody } from "@/lib/api-helpers";
import { enforceRateLimit } from "@/lib/rate-limit";

/** Contact form endpoint. Messages are stored for the platform team to follow up. */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, "contact", 5, 10 * 60_000);
    const input = await parseBody(request, contactSchema);

    await connectDB();
    await ContactMessage.create(input);

    return ok({ received: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
