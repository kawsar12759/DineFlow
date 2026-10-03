import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const description =
  "The all-in-one platform for restaurants to manage branches, menus, reservations, customers, and staff — with real-time analytics.";

export const metadata: Metadata = {
  // Link previews (LinkedIn, WhatsApp, Slack) need absolute image URLs.
  metadataBase: new URL(process.env.APP_URL ?? "https://dineflow-bd.vercel.app"),
  title: {
    default: "DineFlow — Restaurant Operations Platform",
    template: "%s | DineFlow",
  },
  description,
  keywords: [
    "restaurant management",
    "reservations",
    "SaaS",
    "restaurant analytics",
  ],
  openGraph: {
    type: "website",
    siteName: "DineFlow",
    title: "DineFlow — Restaurant Operations Platform",
    description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "DineFlow — Restaurant Operations Platform",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
