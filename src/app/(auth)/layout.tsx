import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(160_70%_42%/0.2),transparent_55%)]"
          aria-hidden
        />
        <Link href="/" className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold text-white">DineFlow</span>
        </Link>
        <blockquote className="relative space-y-3">
          <p className="text-lg leading-relaxed text-white">
            “We went from juggling spreadsheets across six branches to one
            dashboard that the whole team actually uses. Bookings are up,
            no-shows are down.”
          </p>
          <footer className="text-sm text-sidebar-foreground">
            Farhana Rahman — Owner, Ember &amp; Oak
          </footer>
        </blockquote>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
