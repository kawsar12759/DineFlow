import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Restaurant } from "@/models";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DASHBOARD_ROLES } from "@/lib/constants";
import { loadActiveUser } from "@/lib/api-helpers";
import { subscriptionState, type SubscriptionState } from "@/lib/subscription";
import { SubscriptionBanner } from "@/components/dashboard/subscription-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Re-read the user so deactivation and role changes apply immediately.
  const user = await loadActiveUser(session.user.id);
  if (!user) {
    redirect("/signed-out");
  }

  const { role, restaurantId, name, email } = user;

  // DineFlow operators have no restaurant of their own.
  if (role === "super_admin") {
    redirect("/admin");
  }

  if (!DASHBOARD_ROLES.includes(role)) {
    redirect("/");
  }

  let restaurantName: string | undefined;
  let subscription: SubscriptionState | undefined;
  if (restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId)
      .select(
        "name subscriptionPlan subscriptionEndsAt onTrial suspendedAt suspendedReason createdAt"
      )
      .lean();
    restaurantName = restaurant?.name;
    if (restaurant) subscription = subscriptionState(restaurant);
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={name ?? "User"}
          userEmail={email ?? ""}
          role={role}
          restaurantName={restaurantName}
        />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] flex-1 space-y-6 p-4 pb-24 outline-none sm:p-6 lg:pb-6"
        >
          {subscription && (
            <SubscriptionBanner state={subscription} isOwner={role === "owner"} />
          )}
          {children}
        </main>
      </div>
      <MobileNav role={role} />
    </div>
  );
}
