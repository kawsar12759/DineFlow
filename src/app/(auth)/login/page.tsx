"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";

const DEMO_PASSWORD = "password123";
const DEMO_ACCOUNTS = [
  { role: "Owner", email: "owner@ember-oak.com" },
  { role: "Manager", email: "manager@ember-oak.com" },
  { role: "Staff", email: "staff@ember-oak.com" },
];

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [inactiveNotice, setInactiveNotice] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    setInactiveNotice(reason === "inactive");
  }, []);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(
          result.code === "rate_limited"
            ? "Too many sign-in attempts. Please wait 15 minutes and try again."
            : "Invalid email or password"
        );
        return;
      }

      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to your DineFlow dashboard.
      </p>

      {inactiveNotice && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-300"
        >
          Your account has been deactivated or changed. Ask your restaurant
          owner or manager to restore access.
        </p>
      )}

      <form className="mt-8 space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@restaurant.com"
            autoComplete="email"
            {...form.register("email")}
            aria-invalid={!!form.formState.errors.email}
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
          />
          {form.formState.errors.email && (
            <p id="email-error" role="alert" className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            placeholder="••••••••"
            autoComplete="current-password"
            {...form.register("password")}
            aria-invalid={!!form.formState.errors.password}
            aria-describedby={form.formState.errors.password ? "password-error" : undefined}
          />
          {form.formState.errors.password && (
            <p id="password-error" role="alert" className="text-xs text-destructive">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" size="lg" loading={submitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to DineFlow?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-lg border bg-muted/40 p-4">
        <p className="text-xs font-medium">Try the demo</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick a role to fill in the form, then sign in.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                form.setValue("email", account.email, { shouldValidate: true });
                form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
              }}
            >
              {account.role}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
