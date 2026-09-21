"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
import { ALLERGENS, MENU_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  category: z.enum(MENU_CATEGORIES),
  branchId: z.string().optional(),
  preparationTime: z.coerce.number().int().min(0).optional(),
  allergens: z.array(z.enum(ALLERGENS)),
});

type FormValues = z.infer<typeof formSchema>;

export interface MenuItemRecord {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: (typeof MENU_CATEGORIES)[number];
  branchId?: { _id: string; name: string } | string | null;
  availability: boolean;
  allergens: (typeof ALLERGENS)[number][];
  preparationTime?: number;
  createdAt: string;
}

interface MenuItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MenuItemRecord | null;
}

export function MenuItemFormDialog({
  open,
  onOpenChange,
  item,
}: MenuItemFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!item;

  const { data: branchData } = useQuery({
    queryKey: ["branches", "", 1],
    queryFn: () => api.get<{ _id: string; name: string }[]>("/api/branches?limit=100"),
    enabled: open,
  });
  const branches = branchData?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { category: "Mains", allergens: [] },
  });

  useEffect(() => {
    if (open) {
      const branchId =
        item && item.branchId && typeof item.branchId === "object"
          ? item.branchId._id
          : (item?.branchId as string | undefined);
      form.reset(
        item
          ? {
              name: item.name,
              description: item.description ?? "",
              price: item.price,
              category: item.category,
              branchId: branchId ?? "all",
              preparationTime: item.preparationTime,
              allergens: item.allergens,
            }
          : { category: "Mains", allergens: [], branchId: "all" }
      );
    }
  }, [open, item, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        ...values,
        branchId:
          values.branchId && values.branchId !== "all" ? values.branchId : "",
        description: values.description || undefined,
      };
      return isEditing
        ? api.patch(`/api/menu-items/${item._id}`, payload)
        : api.post("/api/menu-items", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Menu item updated" : "Menu item created");
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Something went wrong"
      );
    },
  });

  const selectedAllergens = form.watch("allergens");

  function toggleAllergen(allergen: (typeof ALLERGENS)[number]) {
    const current = form.getValues("allergens");
    form.setValue(
      "allergens",
      current.includes(allergen)
        ? current.filter((a) => a !== allergen)
        : [...current, allergen]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit menu item" : "New menu item"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this dish's details."
              : "Add a new dish to your menu."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Dish name</Label>
              <Input
                id="name"
                placeholder="Charred Octopus"
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min={0}
                {...form.register("price")}
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              placeholder="Spanish octopus, smoked paprika, confit potato…"
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.watch("category")}
                onValueChange={(value) =>
                  form.setValue("category", value as FormValues["category"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MENU_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={form.watch("branchId") ?? "all"}
                onValueChange={(value) => form.setValue("branchId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preparationTime">Prep time (min)</Label>
              <Input
                id="preparationTime"
                type="number"
                min={0}
                {...form.register("preparationTime")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allergens</Label>
            <div className="flex flex-wrap gap-2">
              {ALLERGENS.map((allergen) => {
                const isSelected = selectedAllergens.includes(allergen);
                return (
                  <button
                    key={allergen}
                    type="button"
                    onClick={() => toggleAllergen(allergen)}
                    className="focus-visible:outline-none"
                  >
                    <Badge
                      variant={isSelected ? "default" : "outline"}
                      className={cn("cursor-pointer capitalize select-none")}
                    >
                      {allergen}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {isEditing ? "Save changes" : "Create item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
