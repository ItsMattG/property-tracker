"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  ArrowLeftRight,
  BarChart3,
  Landmark,
  Wallet,
  FileDown,
  PieChart,
  Bell,
  TrendingUp,
  Settings,
  Users,
  History,
  Sparkles,
  Scale,
  BellRing,
  Share2,
  ClipboardCheck,
  Briefcase,
  ShieldCheck,
  Smartphone,
  Calculator,
  Compass,
  MessageSquarePlus,
  Bug,
  Mail,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PortfolioSwitcher } from "./PortfolioSwitcher";
import { EntitySwitcher } from "@/components/entities";
import { FeedbackButton } from "@/components/feedback";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/transactions/review", label: "Review", icon: Sparkles, showBadge: true },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
  { href: "/reports/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/reports/share", label: "Portfolio Shares", icon: Share2 },
  { href: "/reports/compliance", label: "Compliance", icon: ClipboardCheck },
  { href: "/reports/brokers", label: "Broker Portal", icon: Briefcase },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/loans", label: "Loans", icon: Wallet },
  { href: "/loans/compare", label: "Compare Loans", icon: Scale },
  { href: "/export", label: "Export", icon: FileDown },
  { href: "/emails", label: "Emails", icon: Mail },
];

const settingsItems = [
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/refinance-alerts", label: "Refinance Alerts", icon: BellRing },
  { href: "/settings/mobile", label: "Mobile App", icon: Smartphone },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/audit-log", label: "Audit Log", icon: History },
  { href: "/settings/feature-requests", label: "Feature Requests", icon: MessageSquarePlus },
  { href: "/settings/bug-reports", label: "Bug Reports", icon: Bug },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery();
  const { data: activeEntity } = trpc.entity.getActive.useQuery();

  return (
    <aside className="w-64 border-r border-border bg-card min-h-screen p-4">
      <div className="mb-8">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-lg">PropertyTracker</span>
        </Link>
      </div>

      <PortfolioSwitcher />

      <div className="mb-4">
        <EntitySwitcher />
        {activeEntity && (activeEntity.type === "trust" || activeEntity.type === "smsf") && (
          <Link
            href={`/entities/${activeEntity.id}/compliance`}
            className={cn(
              "flex items-center gap-3 px-3 py-2 mt-2 rounded-md text-sm font-medium transition-colors",
              pathname === `/entities/${activeEntity.id}/compliance`
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <ShieldCheck className="w-5 h-5" />
            Entity Compliance
          </Link>
        )}
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const showBadge = "showBadge" in item && item.showBadge && pendingCount?.count && pendingCount.count > 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
              {showBadge && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {pendingCount.count > 99 ? "99+" : pendingCount.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 px-1">
        <FeedbackButton />
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <Settings className="w-4 h-4" />
          Settings
        </div>
        <nav className="space-y-1 mt-1">
          {settingsItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
