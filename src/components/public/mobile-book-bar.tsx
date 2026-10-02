"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";

/**
 * On phones the booking form sits below the menu and reviews. This bar keeps
 * "Book a table" one tap away, and steps aside while the form is on screen.
 */
export function MobileBookBar({ targetId }: { targetId: string }) {
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) =>
      setFormVisible(entry.isIntersecting)
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  if (formVisible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
      <a
        href={`#${targetId}`}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <CalendarCheck className="h-4 w-4" />
        Book a table
      </a>
    </div>
  );
}
