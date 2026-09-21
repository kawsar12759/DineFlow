"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ChefHat,
  LayoutDashboard,
  Store,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/constants";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["super_admin", "owner", "manager", "staff"],
  },
  {
    href: "/dashboard/reservations",
    label: "Reservations",
    icon: CalendarCheck,
    roles: ["super_admin", "owner", "manager", "staff"],
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    icon: Store,
    roles: ["super_admin", "owner", "manager"],
  },
  {
    href: "/dashboard/menu",
    label: "Menu",
    icon: ChefHat,
    roles: ["super_admin", "owner", "manager", "staff"],
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    roles: ["super_admin", "owner", "manager", "staff"],
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    icon: UserCog,
    roles: ["super_admin", "owner", "manager"],
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["super_admin", "owner", "manager"],
  },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <Link
        href="/dashboard"
        className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <UtensilsCrossed className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-white">DineFlow</span>
      </Link>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground">
          DineFlow v1.0 ·{" "}
          <Link href="/" className="hover:text-white">
            Public site
          </Link>
        </p>
      </div>
    </aside>
  );
}

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background lg:hidden">
      {visibleItems.slice(0, 5).map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground",
              isActive && "text-primary"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
