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
  TrendingUp,
  Sparkles,
  Briefcase,
  Calculator,
  Compass,
  PieChart,
  Receipt,
  ChevronsLeft,
  ChevronsRight,
  CalendarDays,
  Award,
  FileOutput,
  Share2,
  Bell,
  FileText,
  GitBranch,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useSidebar } from "./SidebarProvider";
import { featureFlags, type FeatureFlag } from "@/config/feature-flags";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemConfig {
  href: string;
  label: string;
  icon: React.ElementType;
  showBadge?: boolean;
  featureFlag?: FeatureFlag;
}

// Top-level items (always visible, no group)
const topLevelItems: NavItemConfig[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: PieChart, featureFlag: "portfolio" },
  { href: "/discover", label: "Discover", icon: Compass, featureFlag: "discover" },
  { href: "/entities", label: "Entities", icon: Briefcase },
];

// Grouped navigation sections
const navGroups: Array<{
  label: string;
  items: NavItemConfig[];
}> = [
  {
    label: "Properties & Banking",
    items: [
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/transactions/review", label: "Review", icon: Sparkles, showBadge: true },
      { href: "/receipts", label: "Receipts", icon: Receipt, featureFlag: "receipts" },
      { href: "/documents", label: "Documents", icon: FileText, showBadge: true },
      { href: "/banking", label: "Bank Feeds", icon: Landmark },
      { href: "/loans", label: "Loans", icon: Wallet, featureFlag: "loans" },
      { href: "/reminders", label: "Reminders", icon: Bell, featureFlag: "reminders" },
    ],
  },
  {
    label: "Reports & Tax",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
      { href: "/reports/accountant-pack", label: "Accountant Pack", icon: FileOutput, featureFlag: "accountantPack" },
      { href: "/reports/share", label: "Portfolio Shares", icon: Share2, featureFlag: "portfolioShares" },
      { href: "/cash-flow", label: "Cash Flow", icon: CalendarDays, featureFlag: "cashFlow" },
      { href: "/analytics/scorecard", label: "Scorecard", icon: Award, featureFlag: "scorecard" },
      { href: "/analytics/benchmarking", label: "Benchmarking", icon: BarChart3, featureFlag: "portfolioBenchmarking" },
      { href: "/reports/forecast", label: "Forecast", icon: TrendingUp, featureFlag: "forecast" },
      { href: "/reports/scenarios", label: "Scenarios", icon: GitBranch, featureFlag: "scenarios" },
    ],
  },
  {
    label: "Personal Finance",
    items: [
      { href: "/budget", label: "Budget", icon: Wallet },
    ],
  },
  {
    label: "Tools",
    items: [
      { href: "/tools/borrowing-power", label: "Borrowing Power", icon: Calculator, featureFlag: "borrowingPowerEstimator" },
    ],
  },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  badge,
  onMouseEnter,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: React.ReactNode;
  onMouseEnter?: () => void;
  onNavigate?: () => void;
}) {
  const content = (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={onMouseEnter}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 py-2.5 rounded-lg text-sm transition-colors relative cursor-pointer",
        isActive
          ? "bg-primary/10 text-primary font-medium pl-3 pr-3"
          : "text-muted-foreground hover:bg-muted hover:text-foreground pl-3 pr-3",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className={cn("w-[18px] h-[18px] flex-shrink-0", isActive && "text-primary")} />
      {!isCollapsed && (
        <>
          <span className="truncate">{label}</span>
          {badge}
        </>
      )}
      {isCollapsed && badge && (
        <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative">{content}</div>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

function SectionHeading({ label, isCollapsed }: { label: string; isCollapsed: boolean }) {
  if (isCollapsed) return null;

  return (
    <div className="flex items-center gap-3 px-3 pt-2 pb-1">
      <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const utils = trpc.useUtils();
  const shouldFetchPendingCount = pathname === "/dashboard" || pathname === "/transactions/review" || pathname?.startsWith("/transactions");

  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: shouldFetchPendingCount,
  });

  const { data: pendingReviews } = trpc.documentExtraction.listPendingReviews.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: featureFlags.documents,
  });

  const handlePrefetch = (href: string) => {
    if (href === "/dashboard") {
      utils.stats.dashboard.prefetch();
      utils.property.list.prefetch();
    } else if (href === "/portfolio") {
      utils.portfolio.getSummary.prefetch({ period: "monthly" });
      utils.portfolio.getPropertyMetrics.prefetch({ period: "monthly", sortBy: "alphabetical", sortOrder: "desc" });
    } else if (href === "/properties") {
      utils.property.list.prefetch();
    } else if (href === "/transactions") {
      utils.transaction.list.prefetch({ limit: 50, offset: 0 });
    }
  };

  // Collect all nav hrefs for "best match" logic so sub-routes highlight parent
  const allNavHrefs = [
    ...topLevelItems.map((i) => i.href),
    ...navGroups.flatMap((g) => g.items.map((i) => i.href)),
  ];

  const isItemActive = (href: string) => {
    if (pathname === href) return true;
    if (pathname?.startsWith(href + "/")) {
      return !allNavHrefs.some(
        (h) => h !== href && h.length > href.length && (pathname === h || pathname?.startsWith(h + "/"))
      );
    }
    return false;
  };

  const renderNavItem = (item: NavItemConfig) => {
    if (item.featureFlag && !featureFlags[item.featureFlag]) return null;
    const itemIsActive = isItemActive(item.href);
    // Determine badge count based on item href
    let badgeCount = 0;
    if (item.showBadge && item.href === "/transactions/review") {
      badgeCount = pendingCount?.count ?? 0;
    } else if (item.showBadge && item.href === "/documents") {
      badgeCount = pendingReviews?.length ?? 0;
    }

    return (
      <NavItem
        key={item.href}
        href={item.href}
        label={item.label}
        icon={item.icon}
        isActive={itemIsActive}
        isCollapsed={isCollapsed}
        onMouseEnter={() => handlePrefetch(item.href)}
        onNavigate={onNavigate}
        badge={
          badgeCount > 0 ? (
            <span className="ml-auto bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full font-medium">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          ) : undefined
        }
      />
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r border-border bg-card h-screen sticky top-0 py-5 px-3 transition-all duration-200 flex flex-col overflow-hidden shrink-0",
          isCollapsed ? "w-16 px-2" : "w-56 xl:w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("mb-6 px-1", isCollapsed && "flex justify-center px-0")}>
          <Link href="/dashboard" prefetch={false} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-lg tracking-tight">BrickTrack</span>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="space-y-0.5 flex-1 overflow-y-auto" data-tour="sidebar-nav">
          {topLevelItems.filter((item) => !item.featureFlag || featureFlags[item.featureFlag]).map((item) => renderNavItem(item))}

          {/* Grouped sections */}
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.featureFlag || featureFlags[item.featureFlag]
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label} className="mt-5">
                <SectionHeading label={group.label} isCollapsed={isCollapsed} />
                <div className="space-y-0.5 mt-1">
                  {visibleItems.map((item) => renderNavItem(item))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Collapse Toggle Button */}
        <div className="mt-4 pt-4 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full cursor-pointer",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                  isCollapsed && "justify-center px-2"
                )}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronsRight className="w-5 h-5" />
                ) : (
                  <>
                    <ChevronsLeft className="w-5 h-5" />
                    <span>Collapse</span>
                  </>
                )}
              </button>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right">Expand sidebar</TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
