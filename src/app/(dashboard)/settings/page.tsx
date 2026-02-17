"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  Users,
  Wallet,
  MessageSquarePlus,
  Smartphone,
  Link2,
  Mail,
  FileText,
  Shield,
  UserPlus,
  ClipboardList,
  HeadphonesIcon,
  Monitor,
  Sun,
  Moon,
} from "lucide-react";
import Link from "next/link";
import { featureFlags } from "@/config/feature-flags";
import { authClient } from "@/lib/auth-client";
import { applyTheme, STORAGE_KEY, type Theme } from "@/components/theme/ThemeProvider";
import { trpc } from "@/lib/trpc/client";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// ── Theme Toggle ──────────────────────────────────────────────────────

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "forest", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function ThemeToggle() {
  const [activeTheme, setActiveTheme] = useState<Theme>("forest");
  const setThemeMutation = trpc.user.setTheme.useMutation();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && (stored === "dark" || stored === "system")) {
      setActiveTheme(stored);
    }
  }, []);

  const activeIndex = THEME_OPTIONS.findIndex((o) => o.value === activeTheme);

  const handleSelect = (theme: Theme) => {
    const previous = activeTheme;
    setActiveTheme(theme);
    applyTheme(theme);
    setThemeMutation.mutate(
      { theme },
      {
        onError: () => {
          setActiveTheme(previous);
          applyTheme(previous);
        },
      }
    );
  };

  return (
    <div
      className="relative inline-flex h-8 items-center rounded-full border border-border bg-muted"
      role="radiogroup"
      aria-label="Theme preference"
    >
      {/* Sliding indicator */}
      <span
        className={cn(
          "absolute h-6 w-[60px] rounded-full transition-all duration-200 shadow-sm bg-card"
        )}
        style={{ transform: `translateX(${4 + activeIndex * 64}px)` }}
      />
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = activeTheme === option.value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => handleSelect(option.value)}
            className={cn(
              "relative z-10 flex items-center justify-center gap-1.5 w-[64px] text-xs font-medium transition-colors cursor-pointer",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Settings Cards ────────────────────────────────────────────────────

interface SettingsCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

function SettingsCard({ href, icon: Icon, title, description }: SettingsCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:border-primary transition-colors cursor-pointer h-full">
        <CardContent className="flex items-start gap-3 py-5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const settingsSections = [
  {
    title: "Account",
    items: [
      { href: "/settings/billing", icon: Wallet, title: "Billing", description: "Manage your subscription and payment method" },
      { href: "/settings/notifications", icon: Bell, title: "Notifications", description: "Configure email and push notification preferences", featureFlag: "notifications" as const },
      { href: "/settings/mobile", icon: Smartphone, title: "Mobile App", description: "Connect and manage the mobile companion app", featureFlag: "mobileApp" as const },
    ],
  },
  {
    title: "Team",
    items: [
      { href: "/settings/team", icon: Users, title: "Team", description: "Invite members and manage portfolio access", featureFlag: "team" as const },
      { href: "/settings/audit-log", icon: ClipboardList, title: "Audit Log", description: "View all actions taken in your portfolio", featureFlag: "auditLog" as const },
    ],
  },
  {
    title: "Integrations",
    items: [
      { href: "/settings/integrations", icon: Link2, title: "Integrations", description: "Connect third-party services like PropertyMe", featureFlag: "integrations" as const },
      { href: "/settings/email-connections", icon: Mail, title: "Email Connections", description: "Link email accounts for automatic invoice capture", featureFlag: "emailConnections" as const },
      { href: "/settings/loan-packs", icon: FileText, title: "Loan Packs", description: "Generate loan application document packs", featureFlag: "loanPacks" as const },
      { href: "/settings/refinance-alerts", icon: Bell, title: "Refinance Alerts", description: "Get notified when better loan rates are available", featureFlag: "refinanceAlerts" as const },
    ],
  },
  {
    title: "Support & Feedback",
    items: [
      { href: "/settings/feature-requests", icon: MessageSquarePlus, title: "Feature Requests", description: "Vote on and suggest new features", featureFlag: "featureRequests" as const },
      { href: "/settings/support", icon: HeadphonesIcon, title: "Support", description: "Get help from the BrickTrack team", featureFlag: "support" as const },
      { href: "/settings/advisors", icon: Shield, title: "Advisors", description: "Connect with property and tax advisors", featureFlag: "advisors" as const },
      { href: "/settings/referrals", icon: UserPlus, title: "Referrals", description: "Earn free months by referring friends", featureFlag: "referrals" as const },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { data: session } = authClient.useSession();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, integrations, and preferences</p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="text-sm font-medium">{session?.user?.name ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm font-medium">{session?.user?.email ?? "-"}</span>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
            Appearance
          </CardTitle>
        </CardHeader>
        <ThemeToggle />
      </div>

      {settingsSections.map((section) => {
        const visibleItems = section.items.filter(
          (item) => !("featureFlag" in item && item.featureFlag) || featureFlags[item.featureFlag!]
        );

        if (visibleItems.length === 0) return null;

        return (
          <div key={section.title}>
            <CardHeader className="px-0 pt-0 pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                {section.title}
              </CardTitle>
            </CardHeader>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleItems.map((item) => (
                <SettingsCard key={item.href} {...item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
