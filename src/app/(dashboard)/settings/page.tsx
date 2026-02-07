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
} from "lucide-react";
import Link from "next/link";
import { featureFlags } from "@/config/feature-flags";

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
        <CardContent className="flex items-start gap-3 pt-5">
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
      { href: "/settings/notifications", icon: Bell, title: "Notifications", description: "Configure email and push notification preferences" },
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
      { href: "/settings/integrations", icon: Link2, title: "Integrations", description: "Connect third-party services like PropertyMe" },
      { href: "/settings/email-connections", icon: Mail, title: "Email Connections", description: "Link email accounts for automatic invoice capture", featureFlag: "emailConnections" as const },
      { href: "/settings/loan-packs", icon: FileText, title: "Loan Packs", description: "Generate loan application document packs" },
      { href: "/settings/refinance-alerts", icon: Bell, title: "Refinance Alerts", description: "Get notified when better loan rates are available", featureFlag: "refinanceAlerts" as const },
    ],
  },
  {
    title: "Support & Feedback",
    items: [
      { href: "/settings/feature-requests", icon: MessageSquarePlus, title: "Feature Requests", description: "Vote on and suggest new features" },
      { href: "/settings/support", icon: HeadphonesIcon, title: "Support", description: "Get help from the BrickTrack team", featureFlag: "support" as const },
      { href: "/settings/advisors", icon: Shield, title: "Advisors", description: "Connect with property and tax advisors" },
      { href: "/settings/referrals", icon: UserPlus, title: "Referrals", description: "Earn free months by referring friends" },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account, integrations, and preferences</p>
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
