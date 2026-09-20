import { contactSchema } from "@/lib/validations";
import { handleApiError, ok, parseBody } from "@/lib/api-helpers";

/**
 * Contact form endpoint. In production this would forward to a
 * ticketing system or transactional email provider; here we validate
 * and acknowledge.
 */
export async function POST(request: Request) {
  try {
    const input = await parseBody(request, contactSchema);

    console.info("[contact] message received", {
      from: input.email,
      subject: input.subject,
    });

    return ok({ received: true }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
