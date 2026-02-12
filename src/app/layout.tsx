import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc/Provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogProvider } from "@/components/analytics/PostHogProvider";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Skip static generation - app uses auth which requires dynamic rendering
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BrickTrack | Australian Property Investment Tracking",
  description:
    "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
  metadataBase: new URL("https://www.propertytracker.com.au"),
  openGraph: {
    title: "BrickTrack | Australian Property Investment Tracking",
    description:
      "Track your investment properties, automate bank feeds, and generate tax reports. Built for Australian property investors.",
    siteName: "BrickTrack",
    type: "website",
    locale: "en_AU",
    url: "https://www.propertytracker.com.au",
    images: [
      {
        url: "/og-image.svg",
        width: 1200,
        height: 630,
        alt: "BrickTrack | Australian Property Investment Tracking",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "BrickTrack | Australian Property Investment Tracking",
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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <NextTopLoader
          color="hsl(var(--primary))"
          showSpinner={false}
          height={2}
          shadow={false}
        />
        <TRPCProvider>
          <PostHogProvider>{children}</PostHogProvider>
        </TRPCProvider>
        <Toaster richColors position="top-right" />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
