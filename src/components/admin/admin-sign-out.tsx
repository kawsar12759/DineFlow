"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdminSignOut() {
  return (
    <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
