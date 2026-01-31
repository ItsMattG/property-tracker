import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Skip static generation - app uses Clerk auth
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PropertyTracker - Australian Property Investment Tracking",
  description:
    "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
  metadataBase: new URL("https://www.propertytracker.com.au"),
  openGraph: {
    title: "PropertyTracker - Australian Property Investment Tracking",
    description:
      "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
    siteName: "PropertyTracker",
    type: "website",
    locale: "en_AU",
    url: "https://www.propertytracker.com.au",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "PropertyTracker - Australian Property Investment Tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyTracker - Australian Property Investment Tracking",
    description:
      "Track your investment properties, automate bank feeds, and generate tax reports.",
    images: ["/og-image.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <TRPCProvider>
            <PostHogProvider>{children}</PostHogProvider>
          </TRPCProvider>
          <Toaster richColors position="top-right" />
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
