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
  name: z.string().min(1, "Table name is required").max(30),
  seats: z.coerce.number().int().min(1, "At least 1 seat").max(30),
  zone: z.string().max(40).optional(),
});
type FormValues = z.infer<typeof formSchema>;

export interface TableRecord {
  _id: string;
  name: string;
  seats: number;
  zone?: string;
  isActive: boolean;
  branchId: string | { _id: string; name: string };
}

export function TableFormDialog({
  open,
  onOpenChange,
  branchId,
  table,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  table?: TableRecord | null;
}) {
  const queryClient = useQueryClient();
  const isEditing = !!table;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { seats: 4 },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        table
          ? { name: table.name, seats: table.seats, zone: table.zone ?? "" }
          : { name: "", seats: 4, zone: "" }
      );
    }
  }, [open, table, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        name: values.name,
        seats: values.seats,
        zone: values.zone || undefined,
      };
      return isEditing
        ? api.patch(`/api/tables/${table._id}`, payload)
        : api.post("/api/tables", { ...payload, branchId });
    },
    onSuccess: () => {
      toast.success(isEditing ? "Table updated" : "Table added");
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Something went wrong"
      ),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit table" : "New table"}</DialogTitle>
          <DialogDescription>
            Bookings are seated on these tables, so seat counts decide what can
            be booked.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="table-name">Name</Label>
              <Input id="table-name" placeholder="T12" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="table-seats">Seats</Label>
              <Input
                id="table-seats"
                type="number"
                min={1}
                max={30}
                {...form.register("seats")}
              />
              {form.formState.errors.seats && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.seats.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="table-zone">Zone (optional)</Label>
            <Input
              id="table-zone"
              placeholder="Main hall, Terrace, Garden…"
              {...form.register("zone")}
            />
            <p className="text-xs text-muted-foreground">
              Tables are only joined for large parties within the same zone.
            </p>
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
              {isEditing ? "Save changes" : "Add table"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
