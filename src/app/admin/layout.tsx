import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { loadActiveUser } from "@/lib/api-helpers";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { AdminSignOut } from "@/components/admin/admin-sign-out";

/** DineFlow's own operator console; only super admins get in. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = await loadActiveUser(session.user.id);
  if (!user) redirect("/signed-out");
  if (user.role !== "super_admin") redirect("/");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">DineFlow admin</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <ThemeToggle />
            <AdminSignOut />
          </div>
        </div>
      </header>
      <main className="container space-y-6 py-8">{children}</main>
    </div>
  );
}
