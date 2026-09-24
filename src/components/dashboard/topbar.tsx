"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { getInitials } from "@/lib/utils";
import type { Role } from "@/lib/constants";

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  customer: "Customer",
};

interface TopbarProps {
  userName: string;
  userEmail: string;
  role: Role;
  restaurantName?: string;
}

export function Topbar({ userName, userEmail, role, restaurantName }: TopbarProps) {
  const canManageSettings = role === "owner" || role === "super_admin";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold">
          {restaurantName ?? "Your Restaurant"}
        </h2>
        <p className="text-xs text-muted-foreground">{roleLabels[role]} workspace</p>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {roleLabels[role]}
        </Badge>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full outline-none ring-ring focus-visible:ring-2">
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
