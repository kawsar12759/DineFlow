import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "DineFlow — Restaurant Operations Platform",
    template: "%s | DineFlow",
  },
  description:
    "The all-in-one platform for restaurants to manage branches, menus, reservations, customers, and staff — with real-time analytics.",
  keywords: [
    "restaurant management",
    "reservations",
    "SaaS",
    "restaurant analytics",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
