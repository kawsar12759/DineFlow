import Link from "next/link";
import { AlertTriangle, Clock, Lock } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { PLANS } from "@/lib/constants";
import type { SubscriptionState } from "@/lib/subscription";

/**
 * Tells the team when the subscription needs attention: a trial or plan
 * ending within a week, the grace period, or a paused restaurant. Owners
 * get a link to Billing; everyone else is told to ask the owner.
 */
export function SubscriptionBanner({
  state,
  isOwner,
}: {
  state: SubscriptionState;
  isOwner: boolean;
}) {
  const what = state.onTrial ? "free trial" : `${PLANS[state.plan].name} plan`;
  let tone: "info" | "warn" | "stop";
  let message: string;

  switch (state.status) {
    case "trial":
    case "active":
      if (state.daysLeft > 7) return null;
      tone = "info";
      message = `Your ${what} ends ${state.daysLeft <= 1 ? "tomorrow" : `in ${state.daysLeft} days`} (${formatDate(state.endsAt)}).`;
      break;
    case "grace":
      tone = "warn";
      message = `Your ${what} ended on ${formatDate(state.endsAt)}. Everything keeps working until ${formatDate(state.cutoffAt)}, then the dashboard becomes read-only and online booking pauses.`;
      break;
    case "expired":
      tone = "stop";
      message = state.onTrial
        ? "Your free trial has ended. Your data is safe, but changes and online booking are paused until you choose a plan."
        : "Your subscription has ended. Your data is safe, but changes and online booking are paused until you renew.";
      break;
    case "suspended":
      tone = "stop";
      message = `This restaurant has been suspended by DineFlow${state.suspendedReason ? `: ${state.suspendedReason}` : ""}. Please contact support.`;
      break;
  }

  const Icon = tone === "stop" ? Lock : tone === "warn" ? AlertTriangle : Clock;
  const showAction = state.status !== "suspended";

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-3 text-sm print:hidden",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
        tone === "stop" && "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">{message}</p>
      {showAction &&
        (isOwner ? (
          <Link
            href="/dashboard/billing"
            className="shrink-0 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
          >
            {state.status === "trial" || state.onTrial ? "Choose a plan" : "Renew now"}
          </Link>
        ) : (
          <span className="shrink-0 text-xs opacity-80">Ask the owner to renew.</span>
        ))}
    </div>
  );
}
