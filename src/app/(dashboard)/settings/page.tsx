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
  Check,
} from "lucide-react";
import Link from "next/link";
import { featureFlags } from "@/config/feature-flags";
import { authClient } from "@/lib/auth-client";
import { applyTheme, type Theme } from "@/components/theme/ThemeProvider";
import { trpc } from "@/lib/trpc/client";
import { useState, useEffect } from "react";

// ── Theme Picker ──────────────────────────────────────────────────────

const THEMES: {
  id: Theme;
  name: string;
  label: string;
  primary: string;
  bg: string;
  swatch: string[];
}[] = [
  {
    id: "forest",
    name: "Forest",
    label: "Green",
    primary: "#15803d",
    bg: "#ffffff",
    swatch: ["#15803d", "#dcfce7", "#2563EB"],
  },
  {
    id: "clean",
    name: "Clean",
    label: "Blue",
    primary: "#0066cc",
    bg: "#ffffff",
    swatch: ["#0066cc", "#e6f0ff", "#0284C7"],
  },
  {
    id: "dark",
    name: "Dark",
    label: "Night",
    primary: "#2563eb",
    bg: "#0f172a",
    swatch: ["#2563eb", "#1e3a5f", "#60A5FA"],
  },
  {
    id: "friendly",
    name: "Friendly",
    label: "Warm",
    primary: "#047857",
    bg: "#fafaf9",
    swatch: ["#047857", "#d1fae5", "#0891B2"],
  },
  {
    id: "bold",
    name: "Bold",
    label: "Strong",
    primary: "#1d4ed8",
    bg: "#f8fafc",
    swatch: ["#1d4ed8", "#dbeafe", "#0EA5E9"],
  },
  {
    id: "ocean",
    name: "Ocean",
    label: "Teal",
    primary: "#0e7490",
    bg: "#ffffff",
    swatch: ["#0e7490", "#cffafe", "#0284c7"],
  },
];

function ThemePicker() {
  const [activeTheme, setActiveTheme] = useState<Theme>("forest");
  const setThemeMutation = trpc.user.setTheme.useMutation();

  useEffect(() => {
    const stored = localStorage.getItem("bricktrack-theme") as Theme | null;
    if (stored && THEMES.some((t) => t.id === stored)) {
      setActiveTheme(stored);
    }
  }, []);

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
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {THEMES.map((t) => {
        const isActive = activeTheme === t.id;
        const isDark = t.id === "dark";

        return (
          <button
            key={t.id}
            onClick={() => handleSelect(t.id)}
            className="group relative text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded-xl"
            style={{
              focusVisibleRingColor: t.primary,
            } as React.CSSProperties}
          >
            <div
              className={`
                relative overflow-hidden rounded-xl border-2 transition-all duration-200
                ${isActive
                  ? "shadow-md"
                  : "border-[var(--border-light)] hover:border-[var(--border-medium)] hover:shadow-sm"
                }
              `}
              style={{
                borderColor: isActive ? t.primary : undefined,
              }}
            >
              {/* Mini preview area */}
              <div
                className="relative h-16 p-3 flex items-end gap-1.5"
                style={{ backgroundColor: t.bg }}
              >
                {/* Swatch dots showing the palette */}
                <div className="flex gap-1.5">
                  {t.swatch.map((color, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full ring-1 ring-black/5"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Active indicator */}
                {isActive && (
                  <div
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: t.primary }}
                  >
                    <Check
                      className="w-3 h-3"
                      style={{ color: isDark ? "#0f172a" : "#ffffff" }}
                    />
                  </div>
                )}
              </div>

              {/* Label area */}
              <div className="px-3 py-2.5 border-t border-[var(--border-light)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">{t.label}</span>
                </div>
              </div>
            </div>
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
    <div className="space-y-8">
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
        <ThemePicker />
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
