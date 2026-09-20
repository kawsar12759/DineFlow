"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { contactSchema, type ContactInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const contactDetails = [
  {
    icon: Mail,
    label: "Email",
    value: "hello@dineflow.app",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+1 (555) 010-3456",
  },
  {
    icon: MapPin,
    label: "Headquarters",
    value: "548 Market St, San Francisco, CA",
  },
];

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  const form = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
  });

  const mutation = useMutation({
    mutationFn: (values: ContactInput) => api.post("/api/contact", values),
    onSuccess: () => setSent(true),
    onError: () => toast.error("Something went wrong — please try again."),
  });

  return (
    <div className="container py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Talk to our team
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Questions about pricing, onboarding, or migrating from another
          platform? We reply within one business day.
        </p>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl gap-8 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          {contactDetails.map((detail) => (
            <Card key={detail.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <detail.icon className="h-5 w-5 text-accent-foreground" />
                </div>
                <div>
                  <div className="text-sm font-medium">{detail.label}</div>
                  <div className="text-sm text-muted-foreground">{detail.value}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            {sent ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">Message sent!</h2>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Thanks for reaching out. Our team will get back to you within
                  one business day.
                </p>
              </div>
            ) : (
              <form
                className="space-y-4"
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="Jane Smith" {...form.register("name")} />
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
                      placeholder="jane@company.com"
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
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Enterprise pricing for 12 locations"
                    {...form.register("subject")}
                  />
                  {form.formState.errors.subject && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.subject.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    rows={5}
                    placeholder="Tell us about your restaurant…"
                    {...form.register("message")}
                  />
                  {form.formState.errors.message && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.message.message}
                    </p>
                  )}
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  loading={mutation.isPending}
                >
                  <MessageSquare className="h-4 w-4" />
                  Send message
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
