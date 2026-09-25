"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarX, Clock, RefreshCw, UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
  createdAt: string;
  read: boolean;
}

const ICONS: Record<string, typeof Bell> = {
  reservation_created: UtensilsCrossed,
  reservation_cancelled: CalendarX,
  reservation_changed: RefreshCw,
  waitlist_added: Clock,
};

/** "just now", "12 min ago", "3 h ago", "2 d ago". */
function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

export function NotificationBell() {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api.get<{ unreadCount: number; notifications: NotificationItem[] }>(
        "/api/notifications"
      ),
    refetchInterval: 60_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => api.patch("/api/notifications", {}),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.data.unreadCount ?? 0;
  const notifications = data?.data.notifications ?? [];

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open && unread > 0) markAllRead.mutate();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-sm font-medium">
          Notifications
        </div>

        {notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nothing new. Bookings and cancellations show up here.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto scrollbar-thin">
            {notifications.map((notification) => {
              const Icon = ICONS[notification.type] ?? Bell;
              const content = (
                <div
                  className={cn(
                    "flex gap-3 px-3 py-2.5",
                    !notification.read && "bg-accent/50"
                  )}
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.body && (
                      <p className="text-xs text-muted-foreground">
                        {notification.body}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {timeAgo(notification.createdAt)}
                    </p>
                  </div>
                </div>
              );

              return (
                <li key={notification._id} className="border-b last:border-0">
                  {notification.link ? (
                    <Link href={notification.link} className="block hover:bg-accent">
                      {content}
                    </Link>
                  ) : (
                    content
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
