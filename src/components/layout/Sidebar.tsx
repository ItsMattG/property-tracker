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
  CheckSquare,
  Ticket,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PortfolioSwitcher } from "./PortfolioSwitcher";
import { EntitySwitcher } from "@/components/entities";
import { FeedbackButton } from "@/components/feedback";
import { useSidebar } from "./SidebarProvider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  { href: "/reports/mytax", label: "MyTax Export", icon: FileDown },
  { href: "/banking", label: "Banking", icon: Landmark },
  { href: "/loans", label: "Loans", icon: Wallet },
  { href: "/loans/compare", label: "Compare Loans", icon: Scale },
  { href: "/export", label: "Export", icon: FileDown },
  { href: "/emails", label: "Emails", icon: Mail },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
];

const settingsItems = [
  { href: "/settings/notifications", label: "Notifications", icon: Bell },
  { href: "/settings/refinance-alerts", label: "Refinance Alerts", icon: BellRing },
  { href: "/settings/mobile", label: "Mobile App", icon: Smartphone },
  { href: "/settings/team", label: "Team", icon: Users },
  { href: "/settings/audit-log", label: "Audit Log", icon: History },
  { href: "/settings/feature-requests", label: "Feature Requests", icon: MessageSquarePlus },
  { href: "/settings/bug-reports", label: "Bug Reports", icon: Bug },
  { href: "/settings/support", label: "Support", icon: Ticket },
  { href: "/settings/support-admin", label: "Support Admin", icon: Ticket },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  isCollapsed,
  badge,
  onMouseEnter,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  isCollapsed: boolean;
  badge?: React.ReactNode;
  onMouseEnter?: () => void;
}) {
  const content = (
    <Link
      href={href}
      onMouseEnter={onMouseEnter}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
        isCollapsed && "justify-center px-2"
      )}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
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

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const utils = trpc.useUtils();
  const shouldFetchPendingCount = pathname === "/dashboard" || pathname === "/transactions/review" || pathname?.startsWith("/transactions");

  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: shouldFetchPendingCount,
  });
  const { data: activeEntity } = trpc.entity.getActive.useQuery(undefined, {
    staleTime: Infinity,
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

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r border-border bg-card min-h-screen p-4 transition-all duration-200 flex flex-col",
          isCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("mb-8", isCollapsed && "flex justify-center")}>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <span className="font-semibold text-lg">BrickTrack</span>
            )}
          </Link>
        </div>

        {/* Portfolio Switcher */}
        {!isCollapsed && <PortfolioSwitcher />}

        {/* Entity Switcher */}
        <div className={cn("mb-4", isCollapsed && "flex justify-center")}>
          <EntitySwitcher isCollapsed={isCollapsed} />
          {!isCollapsed && activeEntity && (activeEntity.type === "trust" || activeEntity.type === "smsf") && (
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

        {/* Main Navigation */}
        <nav className="space-y-1 flex-1" data-tour="sidebar-nav">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const showBadge = "showBadge" in item && item.showBadge && pendingCount?.count && pendingCount.count > 0;

            return (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                isActive={isActive}
                isCollapsed={isCollapsed}
                onMouseEnter={() => handlePrefetch(item.href)}
                badge={
                  showBadge ? (
                    <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {pendingCount.count > 99 ? "99+" : pendingCount.count}
                    </span>
                  ) : undefined
                }
              />
            );
          })}
        </nav>

        {/* Feedback Button */}
        {!isCollapsed && (
          <div className="mt-4 px-1">
            <FeedbackButton />
          </div>
        )}

        {/* Settings Section */}
        <div className="mt-4 pt-4 border-t border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Settings className="w-4 h-4" />
              Settings
            </div>
          )}
          <nav className="space-y-1 mt-1">
            {settingsItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  isActive={isActive}
                  isCollapsed={isCollapsed}
                />
              );
            })}
          </nav>
        </div>

        {/* Collapse Toggle Button */}
        <div className="mt-4 pt-4 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
                  "text-muted-foreground hover:bg-secondary hover:text-foreground",
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
