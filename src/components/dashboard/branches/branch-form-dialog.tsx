"use client";

import { useEffect, useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BD_DIVISIONS,
  COUNTRY,
  DEFAULT_OPENING_HOURS,
  PHONE_PLACEHOLDER,
  type OpeningHour,
} from "@/lib/constants";
import { describeHours } from "@/lib/availability";
import {
  ClosuresEditor,
  HoursEditor,
  type ClosureValue,
} from "@/components/dashboard/branches/hours-editor";

const formSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  street: z.string().min(2, "Street is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().optional(),
  zip: z.string().optional(),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
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
  hours?: OpeningHour[];
  closures?: { date: string; reason?: string }[];
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
  const [hours, setHours] = useState<OpeningHour[]>(DEFAULT_OPENING_HOURS);
  const [closures, setClosures] = useState<ClosureValue[]>([]);
  const [tab, setTab] = useState("details");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { capacity: 40 },
  });

  useEffect(() => {
    if (open) {
      setTab("details");
      setHours(
        branch?.hours?.length
          ? DEFAULT_OPENING_HOURS.map(
              (fallback) =>
                branch.hours!.find((entry) => entry.day === fallback.day) ??
                fallback
            )
          : DEFAULT_OPENING_HOURS
      );
      setClosures(
        (branch?.closures ?? []).map((closure) => ({
          date: String(closure.date).slice(0, 10),
          reason: closure.reason,
        }))
      );
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
        hours,
        closures,
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
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="details" className="flex-1">
                Details
              </TabsTrigger>
              <TabsTrigger value="hours" className="flex-1">
                Opening hours
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="details"
              className="max-h-[60vh] space-y-4 overflow-y-auto pr-1 scrollbar-thin"
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

            </TabsContent>

            <TabsContent
              value="hours"
              className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 scrollbar-thin"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Weekly hours</Label>
                  <span className="text-xs text-muted-foreground">
                    {describeHours(hours)}
                  </span>
                </div>
                <HoursEditor hours={hours} onChange={setHours} />
                <p className="text-xs text-muted-foreground">
                  Guests can book from opening until the last seating that still
                  finishes before closing.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Closed dates</Label>
                <ClosuresEditor closures={closures} onChange={setClosures} />
              </div>
            </TabsContent>
          </Tabs>

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
