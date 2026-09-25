"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const schema = z.object({ email: z.string().email("Invalid email address") });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  const request = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<{ message: string }>("/api/auth/forgot-password", values),
    onSuccess: (response) => setSent(response.data.message),
    onError: (error) =>
      toast.error(
        error instanceof ApiClientError ? error.message : "Something went wrong"
      ),
  });

  if (sent) {
    return (
      <div className="text-center">
        <MailCheck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{sent}</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Forgot your password?
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter your email and we will send you a link to choose a new one.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={form.handleSubmit((values) => request.mutate(values))}
      >
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@restaurant.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" loading={request.isPending}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
