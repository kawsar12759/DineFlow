"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarCheck,
  ChefHat,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Store,
  UserCog,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["super_admin", "owner"],
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

const MOBILE_SLOTS = 5;

export function MobileNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));
  const needsMore = visibleItems.length > MOBILE_SLOTS;
  const primaryItems = needsMore
    ? visibleItems.slice(0, MOBILE_SLOTS - 1)
    : visibleItems;
  const overflowItems = needsMore ? visibleItems.slice(MOBILE_SLOTS - 1) : [];

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  const overflowActive = overflowItems.some((item) => isActive(item.href));

  const tabClass =
    "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground outline-none focus-visible:bg-accent";

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {primaryItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={cn(tabClass, isActive(item.href) && "text-primary")}
        >
          <item.icon className="h-5 w-5" />
          {item.label}
        </Link>
      ))}

      {needsMore && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(tabClass, overflowActive && "text-primary")}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="mb-2 w-48">
            {overflowItems.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link
                  href={item.href}
                  className={cn(isActive(item.href) && "text-primary")}
                >
                  <item.icon />
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  );
}
