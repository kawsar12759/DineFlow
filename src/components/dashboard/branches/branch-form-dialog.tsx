"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
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

const formSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  street: z.string().min(2, "Street is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  zip: z.string().optional(),
  country: z.string().min(2, "Country is required"),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  openingHours: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface BranchRecord {
  _id: string;
  name: string;
  address: {
    street: string;
    city: string;
    state?: string;
    zip?: string;
    country: string;
  };
  capacity: number;
  contactInfo?: { phone?: string; email?: string };
  openingHours?: string;
  isActive: boolean;
  createdAt: string;
}

interface BranchFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch?: BranchRecord | null;
}

export function BranchFormDialog({
  open,
  onOpenChange,
  branch,
}: BranchFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!branch;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { country: "USA" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        branch
          ? {
              name: branch.name,
              street: branch.address.street,
              city: branch.address.city,
              state: branch.address.state ?? "",
              zip: branch.address.zip ?? "",
              country: branch.address.country,
              capacity: branch.capacity,
              phone: branch.contactInfo?.phone ?? "",
              email: branch.contactInfo?.email ?? "",
              openingHours: branch.openingHours ?? "",
            }
          : { country: "USA", capacity: 40 }
      );
    }
  }, [open, branch, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        address: {
          street: values.street,
          city: values.city,
          state: values.state || undefined,
          zip: values.zip || undefined,
          country: values.country,
        },
        capacity: values.capacity,
        contactInfo: {
          phone: values.phone || undefined,
          email: values.email || undefined,
        },
        openingHours: values.openingHours || undefined,
      };
      return isEditing
        ? api.patch(`/api/branches/${branch._id}`, payload)
        : api.post("/api/branches", payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? "Branch updated" : "Branch created");
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiClientError ? error.message : "Something went wrong"
      );
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit branch" : "New branch"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this location's details."
              : "Add a new location to your restaurant."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Branch name</Label>
              <Input id="name" placeholder="Downtown" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacity">Seating capacity</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                {...form.register("capacity")}
              />
              {form.formState.errors.capacity && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.capacity.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="street">Street address</Label>
            <Input
              id="street"
              placeholder="123 Main Street"
              {...form.register("street")}
            />
            {form.formState.errors.street && (
              <p className="text-xs text-destructive">
                {form.formState.errors.street.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input id="city" placeholder="San Francisco" {...form.register("city")} />
              {form.formState.errors.city && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">State / Province</Label>
              <Input id="state" placeholder="CA" {...form.register("state")} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="zip">ZIP / Postal code</Label>
              <Input id="zip" placeholder="94105" {...form.register("zip")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="country">Country</Label>
              <Input id="country" {...form.register("country")} />
              {form.formState.errors.country && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.country.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+1 555 000 1234"
                {...form.register("phone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="downtown@restaurant.com"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="openingHours">Opening hours</Label>
            <Input
              id="openingHours"
              placeholder="Mon–Sun 11:00–23:00"
              {...form.register("openingHours")}
            />
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
              {isEditing ? "Save changes" : "Create branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
