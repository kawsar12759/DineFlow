"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Armchair,
  BarChart3,
  BookOpenText,
  CalendarCheck,
  CookingPot,
  CreditCard,
  Grid2x2,
  History,
  MessageSquareHeart,
  ReceiptText,
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

type NavGroup = "Service" | "Guests" | "Setup" | "Insights" | "Account";

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  group: NavGroup;
}

const NAV_GROUPS: NavGroup[] = ["Service", "Guests", "Setup", "Insights", "Account"];

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Service",
  },
  {
    href: "/dashboard/reservations",
    label: "Reservations",
    icon: CalendarCheck,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Service",
  },
  {
    href: "/dashboard/floor",
    label: "Floor",
    icon: Grid2x2,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Service",
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: ReceiptText,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Service",
  },
  {
    href: "/dashboard/kitchen",
    label: "Kitchen",
    icon: CookingPot,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Service",
  },
  {
    href: "/dashboard/branches",
    label: "Branches",
    icon: Store,
    roles: ["super_admin", "owner", "manager"],
    group: "Setup",
  },
  {
    href: "/dashboard/tables",
    label: "Tables",
    icon: Armchair,
    roles: ["super_admin", "owner", "manager"],
    group: "Setup",
  },
  {
    href: "/dashboard/menu",
    label: "Menu",
    icon: BookOpenText,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Setup",
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Guests",
  },
  {
    href: "/dashboard/feedback",
    label: "Feedback",
    icon: MessageSquareHeart,
    roles: ["super_admin", "owner", "manager", "staff"],
    group: "Guests",
  },
  {
    href: "/dashboard/staff",
    label: "Staff",
    icon: UserCog,
    roles: ["super_admin", "owner", "manager"],
    group: "Setup",
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
    roles: ["super_admin", "owner", "manager"],
    group: "Insights",
  },
  {
    href: "/dashboard/activity",
    label: "Activity",
    icon: History,
    roles: ["super_admin", "owner", "manager"],
    group: "Insights",
  },
  {
    href: "/dashboard/billing",
    label: "Billing",
    icon: CreditCard,
    roles: ["owner"],
    group: "Account",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    roles: ["super_admin", "owner"],
    group: "Account",
  },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex print:!hidden">
      <Link
        href="/dashboard"
        className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-5"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <UtensilsCrossed className="h-4 w-4 text-primary-foreground" />
        </div>
        <span className="text-lg font-semibold text-white">DineFlow</span>
      </Link>

      <nav
        aria-label="Dashboard"
        className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin"
      >
        {NAV_GROUPS.map((group) => {
          const items = visibleItems.filter((item) => item.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group}>
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                {group}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          active &&
                            "bg-sidebar-accent text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-4">
        <Link
          href="/"
          className="text-xs text-sidebar-foreground hover:text-white"
        >
          View public site →
        </Link>
      </div>
    </aside>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
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

  const isActive = (href: string) => isActivePath(pathname, href);
  const overflowActive = overflowItems.some((item) => isActive(item.href));

  const tabClass =
    "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium text-muted-foreground outline-none focus-visible:bg-accent";

  return (
    <nav
      aria-label="Dashboard"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden print:hidden"
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
