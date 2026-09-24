import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Globe, Mail, MapPin, Phone, Users, UtensilsCrossed } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Branch, MenuItem, Restaurant } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookingWidget,
  type BookingBranch,
} from "@/components/public/booking-widget";
import { bookingSettings, describeHours } from "@/lib/availability";
import { MENU_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";

type PageProps = { params: Promise<{ slug: string }> };

async function loadStorefront(slug: string) {
  await connectDB();
  const restaurant = await Restaurant.findOne({
    slug: slug.toLowerCase(),
    isPublished: true,
  }).lean();
  if (!restaurant) return null;

  const [branches, menu] = await Promise.all([
    Branch.find({ restaurantId: restaurant._id, isActive: true })
      .sort({ _id: 1 })
      .lean(),
    MenuItem.find({ restaurantId: restaurant._id, availability: true })
      .sort({ popularityScore: -1 })
      .lean(),
  ]);

  return { restaurant, branches, menu };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) return { title: "Restaurant not found" };

  const { restaurant } = data;
  return {
    title: `${restaurant.name} — book a table`,
    description:
      restaurant.description ??
      `Reserve a table at ${restaurant.name}${restaurant.cuisine ? ` · ${restaurant.cuisine}` : ""}.`,
  };
}

export default async function RestaurantStorefront({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadStorefront(slug);
  if (!data) notFound();

  const { restaurant, branches, menu } = data;
  const settings = bookingSettings(restaurant.bookingSettings);

  const bookingBranches: BookingBranch[] = branches.map((branch) => ({
    _id: branch._id.toString(),
    name: branch.name,
    city: branch.address.city,
    hours: describeHours(branch.hours),
  }));

  const menuByCategory = MENU_CATEGORIES.map((category) => ({
    category,
    items: menu.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-sidebar text-white">
        <div className="container py-12">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {restaurant.name}
              </h1>
              {restaurant.cuisine && (
                <p className="text-sm text-sidebar-foreground">{restaurant.cuisine}</p>
              )}
            </div>
          </div>

          {restaurant.description && (
            <p className="mt-5 max-w-2xl leading-relaxed text-sidebar-foreground">
              {restaurant.description}
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-sidebar-foreground">
            {restaurant.phone && (
              <a className="flex items-center gap-2 hover:text-white" href={`tel:${restaurant.phone}`}>
                <Phone className="h-4 w-4" />
                {restaurant.phone}
              </a>
            )}
            {restaurant.email && (
              <a className="flex items-center gap-2 hover:text-white" href={`mailto:${restaurant.email}`}>
                <Mail className="h-4 w-4" />
                {restaurant.email}
              </a>
            )}
            {restaurant.website && (
              <a
                className="flex items-center gap-2 hover:text-white"
                href={restaurant.website}
                target="_blank"
                rel="noreferrer"
              >
                <Globe className="h-4 w-4" />
                Website
              </a>
            )}
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {branches.length} {branches.length === 1 ? "location" : "locations"}
            </span>
          </div>
        </div>
      </header>

      <div className="container grid gap-10 py-12 lg:grid-cols-[1fr_400px]">
        <div className="space-y-12">
          {/* Locations */}
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Locations</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {branches.map((branch) => (
                <Card key={branch._id.toString()}>
                  <CardContent className="space-y-2 p-5">
                    <h3 className="font-medium">{branch.name}</h3>
                    <p className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {branch.address.street}, {branch.address.city}
                        {branch.address.zip ? ` ${branch.address.zip}` : ""}
                      </span>
                    </p>
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      {describeHours(branch.hours) || "Hours on request"}
                    </p>
                    {branch.contactInfo?.phone && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4 shrink-0" />
                        {branch.contactInfo.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4 shrink-0" />
                      Seats {branch.capacity}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Menu */}
          <section>
            <h2 className="text-xl font-semibold tracking-tight">Menu</h2>
            {menuByCategory.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                The menu is being updated — please check back soon.
              </p>
            ) : (
              <div className="mt-4 space-y-8">
                {menuByCategory.map(({ category, items }) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {category}
                    </h3>
                    <Separator className="my-3" />
                    <ul className="space-y-4">
                      {items.map((item) => (
                        <li
                          key={item._id.toString()}
                          className="flex items-start justify-between gap-6"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{item.name}</span>
                              {item.allergens.map((allergen) => (
                                <Badge
                                  key={allergen}
                                  variant="outline"
                                  className="text-[10px] capitalize"
                                >
                                  {allergen}
                                </Badge>
                              ))}
                            </div>
                            {item.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <span className="whitespace-nowrap font-medium">
                            {formatCurrency(item.price)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Booking */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          {bookingBranches.length > 0 ? (
            <BookingWidget
              restaurantId={restaurant._id.toString()}
              branches={bookingBranches}
              maxDaysAhead={settings.maxDaysAhead}
            />
          ) : (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              Online booking is not available yet.
            </p>
          )}
        </aside>
      </div>

      <footer className="border-t py-8">
        <div className="container flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {restaurant.name}
          </span>
          <Link href="/" className="hover:text-foreground">
            Powered by DineFlow
          </Link>
        </div>
      </footer>
    </div>
  );
}
