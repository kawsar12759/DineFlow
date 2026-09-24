import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, UtensilsCrossed } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Branch, Restaurant } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { FadeUp, Stagger, StaggerItem } from "@/components/marketing/animated";

export const metadata: Metadata = {
  title: "Book a table",
  description:
    "Choose a DineFlow restaurant and book a table in seconds — real-time availability, instant confirmation.",
};

export const dynamic = "force-dynamic";

async function loadRestaurants() {
  await connectDB();
  const restaurants = await Restaurant.find({ isPublished: true })
    .select("name slug cuisine description")
    .sort({ name: 1 })
    .lean();

  const branches = await Branch.find({
    restaurantId: { $in: restaurants.map((r) => r._id) },
    isActive: true,
  })
    .select("restaurantId address")
    .lean();

  return restaurants.map((restaurant) => ({
    ...restaurant,
    cities: [
      ...new Set(
        branches
          .filter((b) => String(b.restaurantId) === String(restaurant._id))
          .map((b) => b.address.city)
      ),
    ],
  }));
}

export default async function ReservePage() {
  const restaurants = await loadRestaurants();

  return (
    <div className="container py-20">
      <FadeUp className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Book a table
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Pick a restaurant to see live availability and reserve your table.
        </p>
      </FadeUp>

      {restaurants.length === 0 ? (
        <EmptyState
          className="mt-16"
          icon={UtensilsCrossed}
          title="No restaurants are taking bookings yet"
          description="Check back soon — new restaurants join DineFlow every week."
        />
      ) : (
        <Stagger className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <StaggerItem key={restaurant._id.toString()}>
              <Card className="flex h-full flex-col transition-shadow hover:shadow-md">
                <CardContent className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg font-semibold">{restaurant.name}</h2>
                  {restaurant.cuisine && (
                    <Badge variant="secondary" className="mt-2 w-fit">
                      {restaurant.cuisine}
                    </Badge>
                  )}
                  {restaurant.description && (
                    <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {restaurant.description}
                    </p>
                  )}
                  {restaurant.cities.length > 0 && (
                    <p className="mt-4 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {restaurant.cities.join(", ")}
                    </p>
                  )}
                  <Button asChild className="mt-6 w-full">
                    <Link href={`/r/${restaurant.slug}`}>
                      Book a table
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
