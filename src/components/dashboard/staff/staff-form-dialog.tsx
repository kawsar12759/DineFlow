"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
import { STAFF_SHIFTS } from "@/lib/constants";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const formSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().optional(),
  role: z.enum(["manager", "staff"]),
  branchId: z.string().optional(),
  shift: z.enum(STAFF_SHIFTS).optional(),
  position: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface StaffRecord {
  _id: string;
  name: string;
  email: string;
  role: "manager" | "staff";
  branchId?: { _id: string; name: string } | string | null;
  shift?: (typeof STAFF_SHIFTS)[number];
  position?: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

interface StaffFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: StaffRecord | null;
  currentRole: string;
}

export function StaffFormDialog({
  open,
  onOpenChange,
  member,
  currentRole,
}: StaffFormDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!member;
  const [invite, setInvite] = useState(true);

  const { data: branchData } = useQuery({
    queryKey: ["branches", "", 1],
    queryFn: () => api.get<{ _id: string; name: string }[]>("/api/branches?limit=100"),
    enabled: open,
  });
  const branches = branchData?.data ?? [];

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { role: "staff" },
  });

  useEffect(() => {
    if (open) {
      const branchId =
        member && member.branchId && typeof member.branchId === "object"
          ? member.branchId._id
          : (member?.branchId as string | undefined);
      setInvite(true);
      form.reset(
        member
          ? {
              name: member.name,
              email: member.email,
              password: "",
              role: member.role,
              branchId: branchId ?? "none",
              shift: member.shift,
              position: member.position ?? "",
              phone: member.phone ?? "",
            }
          : { role: "staff", branchId: "none" }
      );
    }
  }, [open, member, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      // New members are invited by email unless a password is typed here.
      if (!isEditing && !invite && (values.password ?? "").length < 8) {
        throw new ApiClientError("Password must be at least 8 characters", 422);
      }
      const payload = {
        name: values.name,
        email: values.email,
        role: values.role,
        branchId:
          values.branchId && values.branchId !== "none" ? values.branchId : "",
        shift: values.shift,
        position: values.position || undefined,
        phone: values.phone || undefined,
        ...(values.password ? { password: values.password } : {}),
      };
      return isEditing
        ? api.patch(`/api/staff/${member._id}`, payload)
        : api.post("/api/staff", {
            ...payload,
            ...(invite ? {} : { password: values.password }),
          });
    },
    onSuccess: () => {
      toast.success(
        isEditing
          ? "Staff member updated"
          : invite
            ? "Invite sent"
            : "Staff member added"
      );
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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
          <DialogTitle>
            {isEditing ? "Edit team member" : "Invite team member"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update role, branch assignment, or shift."
              : "Create a dashboard account for a manager or staff member."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Rahim Uddin" {...form.register("name")} />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="rahim@restaurant.com"
                disabled={isEditing}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-1.5">
              <Label htmlFor="password">New password (leave blank to keep)</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                {...form.register("password")}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label htmlFor="invite">Email an invite</Label>
                  <p className="text-xs text-muted-foreground">
                    {invite
                      ? "They set their own password from a link that expires in 72 hours."
                      : "You choose the password and share it yourself."}
                  </p>
                </div>
                <Switch id="invite" checked={invite} onCheckedChange={setInvite} />
              </div>

              {!invite && (
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 8 characters"
                    {...form.register("password")}
                  />
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.watch("role")}
                onValueChange={(value) =>
                  form.setValue("role", value as "manager" | "staff")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff</SelectItem>
                  {currentRole !== "manager" && (
                    <SelectItem value="manager">Manager</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={form.watch("branchId") ?? "none"}
                onValueChange={(value) => form.setValue("branchId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch._id} value={branch._id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Shift</Label>
              <Select
                value={form.watch("shift") ?? ""}
                onValueChange={(value) =>
                  form.setValue("shift", value as FormValues["shift"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_SHIFTS.map((shift) => (
                    <SelectItem key={shift} value={shift} className="capitalize">
                      {shift}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                placeholder="Head waiter"
                {...form.register("position")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder="+880 1712-345678"
                {...form.register("phone")}
              />
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
              {isEditing ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
