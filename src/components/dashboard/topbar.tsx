"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { CalendarDays, LogOut, Settings, User, UtensilsCrossed } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { getInitials } from "@/lib/utils";
import { TIMEZONE, type Role } from "@/lib/constants";

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  customer: "Customer",
};

// Fixed time zone, so the server and browser render the same text.
const todayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

interface TopbarProps {
  userName: string;
  userEmail: string;
  role: Role;
  restaurantName?: string;
}

export function Topbar({ userName, userEmail, role, restaurantName }: TopbarProps) {
  const canManageSettings = role === "owner" || role === "super_admin";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur-md sm:px-6 print:hidden">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/dashboard"
          aria-label="DineFlow home"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary lg:hidden"
        >
          <UtensilsCrossed className="h-4 w-4 text-primary-foreground" />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {restaurantName ?? "Your Restaurant"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {roleLabels[role]} workspace
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2">
        <span className="mr-2 hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
          <CalendarDays className="h-4 w-4" />
          {todayFormatter.format(new Date())}
        </span>
        <NotificationBell />
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Account menu"
            className="ml-1 rounded-full outline-none ring-ring focus-visible:ring-2"
          >
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(userName)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium">{userName}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {userEmail}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>
            {canManageSettings && (
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings />
                  Settings
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
