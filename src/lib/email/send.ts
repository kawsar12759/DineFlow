/**
 * Transactional email. Uses Resend when RESEND_API_KEY and EMAIL_FROM are
 * set, and otherwise logs the message — so development and tests work with
 * no credentials. Sending never throws: a failed email must not fail the
 * booking (or invite) that triggered it.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailResult {
  sent: boolean;
  provider: "resend" | "console";
  id?: string;
  error?: string;
}

function config() {
  return {
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM,
  };
}

export function emailIsConfigured() {
  const { apiKey, from } = config();
  return !!apiKey && !!from;
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const { apiKey, from } = config();

  if (!apiKey || !from) {
    console.info(
      `[email:console] to=${message.to} subject="${message.subject}"\n${message.text}`
    );
    return { sent: false, provider: "console" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });

    const body = (await response.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!response.ok) {
      const error = body?.message ?? `Resend responded ${response.status}`;
      console.error("[email:resend] failed", error);
      return { sent: false, provider: "resend", error };
    }

    return { sent: true, provider: "resend", id: body?.id };
  } catch (error) {
    console.error("[email:resend] request failed", error);
    return {
      sent: false,
      provider: "resend",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
