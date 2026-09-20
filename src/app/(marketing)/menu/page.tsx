"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChefHat, Clock, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { useDebounce } from "@/hooks/use-debounce";
import { MENU_CATEGORIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";

interface PublicMenuItem {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  allergens: string[];
  preparationTime?: number;
}

export default function PublicMenuPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search);

  const { data, isLoading } = useQuery({
    queryKey: ["public-menu", debouncedSearch, category, page],
    queryFn: () =>
      api.get<PublicMenuItem[]>(
        `/api/public/menu?search=${encodeURIComponent(debouncedSearch)}&category=${category}&page=${page}&limit=12`
      ),
    placeholderData: keepPreviousData,
  });

  const items = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Explore the menu
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Browse dishes from our partner restaurants — filtered, searchable,
          allergen-aware.
        </p>
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search dishes…"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <Tabs
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
        >
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {MENU_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mt-12">
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-6">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-4 w-full" />
                  <Skeleton className="mt-2 h-4 w-3/4" />
                  <Skeleton className="mt-4 h-6 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="No dishes found"
            description="Try a different search or category."
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Card
                  key={item._id}
                  className="flex flex-col transition-shadow hover:shadow-md"
                >
                  <CardContent className="flex flex-1 flex-col p-6">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{item.name}</h3>
                      <span className="shrink-0 font-semibold text-primary">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                    <Badge variant="secondary" className="mt-2 w-fit">
                      {item.category}
                    </Badge>
                    {item.description && (
                      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {item.preparationTime ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {item.preparationTime} min
                        </span>
                      ) : null}
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
                  </CardContent>
                </Card>
              ))}
            </div>
            {pagination && (
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
