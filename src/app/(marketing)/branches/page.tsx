"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, MapPin, Phone, Search, Store, Users } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";

interface PublicBranch {
  _id: string;
  name: string;
  address: { street: string; city: string; state?: string; country: string };
  capacity: number;
  contactInfo?: { phone?: string; email?: string };
  openingHours?: string;
  restaurant?: { name: string; slug: string; cuisine?: string } | null;
}

export default function BranchDirectoryPage() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ["public-branches", debouncedSearch],
    queryFn: () =>
      api.get<PublicBranch[]>(
        `/api/public/branches?search=${encodeURIComponent(debouncedSearch)}`
      ),
  });

  const branches = data?.data ?? [];

  return (
    <div className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Branch directory
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Find a DineFlow-powered restaurant near you and book in seconds.
        </p>
        <div className="relative mx-auto mt-8 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or city…"
            className="pl-9"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="mt-14">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-4 w-1/2" />
                  <Skeleton className="mt-6 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : branches.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No branches found"
            description={
              debouncedSearch
                ? `Nothing matches “${debouncedSearch}”. Try a different search.`
                : "No branches are listed yet — check back soon."
            }
          />
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {branches.map((branch) => (
              <Card
                key={branch._id}
                className="flex flex-col transition-shadow hover:shadow-md"
              >
                <CardContent className="flex flex-1 flex-col p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{branch.name}</h3>
                      {branch.restaurant && (
                        <p className="text-sm text-muted-foreground">
                          {branch.restaurant.name}
                        </p>
                      )}
                    </div>
                    {branch.restaurant?.cuisine && (
                      <Badge variant="secondary">{branch.restaurant.cuisine}</Badge>
                    )}
                  </div>
                  <div className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {branch.address.street}, {branch.address.city}
                    </p>
                    {branch.openingHours && (
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0" />
                        {branch.openingHours}
                      </p>
                    )}
                    {branch.contactInfo?.phone && (
                      <p className="flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        {branch.contactInfo.phone}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" />
                      Seats up to {branch.capacity}
                    </p>
                  </div>
                  <Button className="mt-5 w-full" asChild>
                    <Link href={`/r/${branch.restaurant?.slug ?? ""}`}>Book a table</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
