"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CheckCircle2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters"),
});
type FormValues = z.infer<typeof schema>;

interface TokenInfo {
  valid: boolean;
  purpose?: "invite" | "reset";
  name?: string;
  email?: string;
}

function SetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery({
    queryKey: ["password-token", token],
    queryFn: () =>
      api.get<TokenInfo>(
        `/api/auth/set-password?token=${encodeURIComponent(token)}`
      ),
    enabled: !!token,
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      api.post("/api/auth/set-password", { token, password: values.password }),
    onSuccess: () => {
      setDone(true);
      setTimeout(() => router.push("/login"), 2500);
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not set password"
      ),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  if (!token || !data?.data.valid) {
    return (
      <div className="text-center">
        <Link2Off className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          This link is no longer valid
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Invite and reset links expire, and each one works only once. Ask for a
          new link and try again.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Password set
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Taking you to sign in…
        </p>
      </div>
    );
  }

  const invite = data.data.purpose === "invite";

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {invite ? "Welcome to DineFlow" : "Choose a new password"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {invite
          ? `Hi ${data.data.name}, set a password to finish setting up your account.`
          : `Setting a new password for ${data.data.email}.`}
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
      >
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" loading={save.isPending}>
          {invite ? "Set password and continue" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
