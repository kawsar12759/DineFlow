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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BD_DIVISIONS, COUNTRY, PHONE_PLACEHOLDER } from "@/lib/constants";

const formSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  street: z.string().min(2, "Street is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  zip: z.string().optional(),
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
    defaultValues: { capacity: 40 },
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
              capacity: branch.capacity,
              phone: branch.contactInfo?.phone ?? "",
              email: branch.contactInfo?.email ?? "",
              openingHours: branch.openingHours ?? "",
            }
          : { capacity: 40 }
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
          country: COUNTRY,
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
              placeholder="House 42, Road 11, Banani"
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
              <Input id="city" placeholder="Dhaka" {...form.register("city")} />
              {form.formState.errors.city && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state">Division</Label>
              <Select
                value={form.watch("state") || undefined}
                onValueChange={(value) =>
                  form.setValue("state", value, { shouldDirty: true })
                }
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="Select division" />
                </SelectTrigger>
                <SelectContent>
                  {BD_DIVISIONS.map((division) => (
                    <SelectItem key={division} value={division}>
                      {division}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5 sm:w-1/2 sm:pr-2">
            <Label htmlFor="zip">Postal code</Label>
            <Input id="zip" placeholder="1213" {...form.register("zip")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder={PHONE_PLACEHOLDER}
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
              placeholder="Sat–Thu 12:00–23:00"
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
