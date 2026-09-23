import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Restaurant } from "@/models";
import { Sidebar, MobileNav } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { DASHBOARD_ROLES } from "@/lib/constants";
import { loadActiveUser } from "@/lib/api-helpers";

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

  if (!DASHBOARD_ROLES.includes(role)) {
    redirect("/");
  }

  let restaurantName: string | undefined;
  if (restaurantId) {
    const restaurant = await Restaurant.findById(restaurantId)
      .select("name")
      .lean();
    restaurantName = restaurant?.name;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          userName={name ?? "User"}
          userEmail={email ?? ""}
          role={role}
          restaurantName={restaurantName}
        />
        <main className="flex-1 space-y-6 p-4 pb-24 sm:p-6 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileNav role={role} />
    </div>
  );
}
