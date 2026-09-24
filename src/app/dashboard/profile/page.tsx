"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { api, ApiClientError } from "@/lib/api-client";
import { profileUpdateSchema } from "@/lib/validations";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import { PHONE_PLACEHOLDER, type Role } from "@/lib/constants";

interface Profile {
  name: string;
  email: string;
  phone?: string;
  position?: string;
  shift?: string;
  role: Role;
  branchId?: { _id: string; name: string } | null;
}

const detailsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  phone: z.string().max(30).optional().or(z.literal("")),
});
type DetailsInput = z.infer<typeof detailsSchema>;

const passwordSchema = profileUpdateSchema;
type PasswordInput = z.infer<typeof passwordSchema>;

const roleLabels: Record<Role, string> = {
  super_admin: "Super Admin",
  owner: "Owner",
  manager: "Manager",
  staff: "Staff",
  customer: "Customer",
};

export default function ProfilePage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => api.get<Profile>("/api/profile"),
  });
  const profile = data?.data;

  const detailsForm = useForm<DetailsInput>({
    resolver: zodResolver(detailsSchema),
  });
  const passwordForm = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "" },
  });

  useEffect(() => {
    if (profile) {
      detailsForm.reset({ name: profile.name, phone: profile.phone ?? "" });
    }
  }, [profile, detailsForm]);

  const saveDetails = useMutation({
    mutationFn: (values: DetailsInput) => api.patch("/api/profile", values),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not save profile"
      ),
  });

  const changePassword = useMutation({
    mutationFn: (values: PasswordInput) => api.patch("/api/profile", values),
    onSuccess: () => {
      toast.success("Password changed");
      passwordForm.reset({ currentPassword: "", newPassword: "" });
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not change password"
      ),
  });

  if (isLoading || !profile) {
    return (
      <>
        <PageHeader title="Your profile" description="Your account details." />
        <Skeleton className="h-56 w-full" />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Your profile" description="Your account and password." />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <CardTitle className="truncate">{profile.name}</CardTitle>
              <CardDescription className="truncate">{profile.email}</CardDescription>
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-2">
              <Badge variant="secondary">{roleLabels[profile.role]}</Badge>
              {profile.branchId && (
                <Badge variant="outline">{profile.branchId.name}</Badge>
              )}
              {profile.shift && (
                <Badge variant="outline" className="capitalize">
                  {profile.shift}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <form
          onSubmit={detailsForm.handleSubmit((values) => saveDetails.mutate(values))}
        >
          <CardHeader>
            <CardTitle>Your details</CardTitle>
            <CardDescription>
              Your email and role are managed by your restaurant owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" {...detailsForm.register("name")} />
              {detailsForm.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {detailsForm.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                placeholder={PHONE_PLACEHOLDER}
                {...detailsForm.register("phone")}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={saveDetails.isPending}>
              Save changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <form
          onSubmit={passwordForm.handleSubmit((values) =>
            changePassword.mutate(values)
          )}
        >
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              You need your current password to set a new one.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("currentPassword")}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...passwordForm.register("newPassword")}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">
                  {passwordForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" loading={changePassword.isPending}>
              Change password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
