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
} from "lucide-react";
import { PortfolioSwitcher } from "./PortfolioSwitcher";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/properties", label: "Properties", icon: Building2 },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/reports/forecast", label: "Forecast", icon: TrendingUp },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/loans", label: "Loans", icon: Wallet },
  { href: "/export", label: "Export", icon: FileDown },
];

const settingsItems = [
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/team", label: "Team", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

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

      <nav className="space-y-1">
        {navItems.map((item) => {
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

      <div className="mt-8 pt-4 border-t border-border">
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
