import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Gift, Globe, Mail, MapPin, Phone, Star, Users, UtensilsCrossed } from "lucide-react";
import { connectDB } from "@/lib/db";
import { Branch, Feedback, MenuItem, Restaurant } from "@/models";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  BookingWidget,
  type BookingBranch,
} from "@/components/public/booking-widget";
import { bookingSettings, describeHours } from "@/lib/availability";
import { MENU_CATEGORIES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/utils";
import { feedbackSettings, publicGuestName, ratingSummary } from "@/lib/feedback";
import { loyaltySettings } from "@/lib/loyalty";
import { StarRating } from "@/components/shared/star-rating";

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

  const showReviews = feedbackSettings(restaurant.feedbackSettings).showOnPublicPage;
  const [rating, reviews] = showReviews
    ? await Promise.all([
        ratingSummary({ restaurantId: restaurant._id, isPublic: true }),
        Feedback.find({
          restaurantId: restaurant._id,
          isPublic: true,
          comment: { $exists: true, $ne: "" },
        })
          .sort({ createdAt: -1 })
          .limit(6)
          .populate<{ customerId: { name: string } | null }>("customerId", "name")
          .populate<{ branchId: { name: string } | null }>("branchId", "name")
          .lean(),
      ])
    : [null, []];

  return { restaurant, branches, menu, rating, reviews };
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

  const { restaurant, branches, menu, rating, reviews } = data;
  const settings = bookingSettings(restaurant.bookingSettings);
  const loyalty = loyaltySettings(restaurant.loyaltySettings);

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
            {rating && rating.count > 0 && (
              <a href="#reviews" className="flex items-center gap-2 hover:text-white">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {rating.average.toFixed(1)} · {rating.count}{" "}
                {rating.count === 1 ? "review" : "reviews"}
              </a>
            )}
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

          {/* Reviews */}
          {rating && rating.count > 0 && (
            <section id="reviews" className="scroll-mt-8">
              <h2 className="text-xl font-semibold tracking-tight">What guests say</h2>
              <div className="mt-4 flex flex-wrap items-center gap-6">
                <div>
                  <div className="text-4xl font-semibold">{rating.average.toFixed(1)}</div>
                  <StarRating value={rating.average} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {rating.count} verified {rating.count === 1 ? "visit" : "visits"}
                  </p>
                </div>
                <div className="min-w-[200px] flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = rating.distribution[stars - 1];
                    return (
                      <div key={stars} className="flex items-center gap-2 text-xs">
                        <span className="w-3 text-muted-foreground">{stars}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${(count / rating.count) * 100}%` }}
                          />
                        </div>
                        <span className="w-6 text-right text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {reviews.length > 0 && (
                <ul className="mt-6 grid gap-4 sm:grid-cols-2">
                  {reviews.map((review) => (
                    <li key={review._id.toString()}>
                      <Card className="h-full">
                        <CardContent className="space-y-2 p-5">
                          <div className="flex items-center justify-between gap-2">
                            <StarRating value={review.rating} />
                            <span className="text-xs text-muted-foreground">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm leading-relaxed">“{review.comment}”</p>
                          <p className="text-xs text-muted-foreground">
                            {publicGuestName(review.customerId?.name ?? "Guest")}
                            {review.branchId ? ` · ${review.branchId.name}` : ""}
                          </p>
                          {review.reply?.body && (
                            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">
                                Reply from {restaurant.name}:
                              </span>{" "}
                              {review.reply.body}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
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
          {loyalty.enabled && (
            <div className="mt-4 flex gap-3 rounded-xl border p-4 text-sm">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Earn points every visit</p>
                <p className="mt-1 text-muted-foreground">
                  {loyalty.pointsPer100Taka} points for every ৳100 you spend, worth{" "}
                  {formatCurrency(loyalty.pointValueTaka)} each off a later bill.{" "}
                  <Link href="/account" className="text-primary hover:underline">
                    See your points
                  </Link>
                </p>
              </div>
            </div>
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
