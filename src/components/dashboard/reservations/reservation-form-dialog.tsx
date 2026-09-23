"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
import { todayKey } from "@/lib/dates";
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

const formSchema = z.object({
  branchId: z.string().min(1, "Branch is required"),
  customerName: z.string().min(2, "Customer name is required"),
  customerEmail: z.string().email("Invalid email"),
  customerPhone: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM format"),
  guests: z.coerce.number().int().min(1).max(50),
  estimatedSpend: z.coerce.number().min(0).optional(),
  specialRequests: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ReservationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReservationFormDialog({
  open,
  onOpenChange,
}: ReservationFormDialogProps) {
  const queryClient = useQueryClient();

  const { data: branchData } = useQuery({
    queryKey: ["branches", "", 1],
    queryFn: () => api.get<{ _id: string; name: string }[]>("/api/branches?limit=100"),
    enabled: open,
  });
  const branches = branchData?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    if (open) {
      form.reset({
        date: todayKey(),
        time: "19:00",
        guests: 2,
      });
    }
  }, [open, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/api/reservations", {
        branchId: values.branchId,
        customer: {
          name: values.customerName,
          email: values.customerEmail,
          phone: values.customerPhone || undefined,
        },
        date: values.date,
        time: values.time,
        guests: values.guests,
        estimatedSpend: values.estimatedSpend,
        specialRequests: values.specialRequests || undefined,
      }),
    onSuccess: () => {
      toast.success("Reservation created");
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
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
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>
            Create a booking on behalf of a guest (phone or walk-in).
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <Select
              value={form.watch("branchId") ?? ""}
              onValueChange={(value) =>
                form.setValue("branchId", value, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch._id} value={branch._id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.branchId && (
              <p className="text-xs text-destructive">
                {form.formState.errors.branchId.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" {...form.register("date")} />
              {form.formState.errors.date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.date.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="time">Time</Label>
              <Input id="time" type="time" {...form.register("time")} />
              {form.formState.errors.time && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.time.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="guests">Guests</Label>
              <Input
                id="guests"
                type="number"
                min={1}
                max={50}
                {...form.register("guests")}
              />
              {form.formState.errors.guests && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.guests.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customerName">Customer name</Label>
              <Input
                id="customerName"
                placeholder="Nusrat Jahan"
                {...form.register("customerName")}
              />
              {form.formState.errors.customerName && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.customerName.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customerEmail">Customer email</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="nusrat@example.com"
                {...form.register("customerEmail")}
              />
              {form.formState.errors.customerEmail && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.customerEmail.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="customerPhone">Phone (optional)</Label>
              <Input
                id="customerPhone"
                placeholder="+880 1712-345678"
                {...form.register("customerPhone")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedSpend">Estimated spend (৳)</Label>
              <Input
                id="estimatedSpend"
                type="number"
                step="0.01"
                min={0}
                {...form.register("estimatedSpend")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="specialRequests">Special requests</Label>
            <Textarea
              id="specialRequests"
              rows={2}
              {...form.register("specialRequests")}
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
              Create reservation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
