"use client";

import { useState, useEffect, useCallback } from "react";
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
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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
  { href: "/discover", label: "Discover", icon: Compass, featureFlag: "discover" },
  { href: "/entities", label: "Entities", icon: Briefcase },
];

// Grouped navigation sections
const navGroups: Array<{
  label: string;
  icon: React.ElementType;
  defaultOpen: boolean;
  items: NavItemConfig[];
}> = [
  {
    label: "Properties & Banking",
    icon: Building2,
    defaultOpen: true,
    items: [
      { href: "/properties", label: "Properties", icon: Building2 },
      { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/transactions/review", label: "Review", icon: Sparkles, showBadge: true },
      { href: "/banking", label: "Bank Feeds", icon: Landmark },
      { href: "/loans", label: "Loans", icon: Wallet, featureFlag: "loans" },
    ],
  },
  {
    label: "Reports & Tax",
    icon: BarChart3,
    defaultOpen: true,
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/reports/tax-position", label: "Tax Position", icon: Calculator },
      { href: "/reports/forecast", label: "Forecast", icon: TrendingUp, featureFlag: "forecast" },
    ],
  },
];


function usePersistedSections() {
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-sections");
      if (stored) setSections(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, []);

  const toggle = useCallback((label: string, defaultOpen: boolean) => {
    setSections((prev) => {
      const current = prev[label] ?? defaultOpen;
      const next = { ...prev, [label]: !current };
      try { localStorage.setItem("sidebar-sections", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const isOpen = useCallback(
    (label: string, defaultOpen: boolean) => {
      if (!hydrated) return defaultOpen;
      return sections[label] ?? defaultOpen;
    },
    [sections, hydrated]
  );

  return { isOpen, toggle };
}

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
        "flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors relative cursor-pointer",
        isActive
          ? "border-l-2 border-primary bg-primary/5 text-primary font-semibold pl-[10px] pr-3"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground pl-3 pr-3",
        isCollapsed && "justify-center px-2 border-l-0 pl-2"
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

function NavGroup({
  label,
  icon: Icon,
  isOpen,
  onToggle,
  isCollapsed,
  children,
}: {
  label: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  isCollapsed: boolean;
  children: React.ReactNode;
}) {
  if (isCollapsed) {
    return <>{children}</>;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleTrigger className="flex items-center gap-2 px-3 py-1.5 w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors cursor-pointer">
        <Icon className="w-3.5 h-3.5" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5 mt-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isCollapsed, toggle } = useSidebar();
  const utils = trpc.useUtils();
  const { isOpen, toggle: toggleSection } = usePersistedSections();
  const shouldFetchPendingCount = pathname === "/dashboard" || pathname === "/transactions/review" || pathname?.startsWith("/transactions");

  const { data: pendingCount } = trpc.categorization.getPendingCount.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    enabled: shouldFetchPendingCount,
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
    // Check if pathname is a sub-route of this item (e.g. /loans/new → /loans)
    if (pathname?.startsWith(href + "/")) {
      // Only highlight if no other nav item is a more specific match
      return !allNavHrefs.some(
        (h) => h !== href && h.length > href.length && (pathname === h || pathname?.startsWith(h + "/"))
      );
    }
    return false;
  };

  const renderNavItem = (item: NavItemConfig) => {
    if (item.featureFlag && !featureFlags[item.featureFlag]) return null;
    const itemIsActive = isItemActive(item.href);
    const showBadge = item.showBadge && pendingCount?.count && pendingCount.count > 0;

    return (
      <NavItem
        key={item.href}
        href={item.href}
        label={item.label}
        icon={item.icon}
        isActive={itemIsActive}
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
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "border-r border-border bg-card h-screen sticky top-0 p-4 transition-all duration-200 flex flex-col overflow-hidden shrink-0",
          isCollapsed ? "w-16" : "w-56 xl:w-64"
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


        {/* Top-level Navigation */}
        <nav className="space-y-1 flex-1 overflow-y-auto" data-tour="sidebar-nav">
          {topLevelItems.filter((item) => !item.featureFlag || featureFlags[item.featureFlag]).map((item) => renderNavItem(item))}

          {/* Grouped sections */}
          <div className="space-y-3 mt-3">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.featureFlag || featureFlags[item.featureFlag]
              );
              if (visibleItems.length === 0) return null;

              return (
                <NavGroup
                  key={group.label}
                  label={group.label}
                  icon={group.icon}
                  isOpen={isOpen(group.label, group.defaultOpen)}
                  onToggle={() => toggleSection(group.label, group.defaultOpen)}
                  isCollapsed={isCollapsed}
                >
                  {visibleItems.map((item) => renderNavItem(item))}
                </NavGroup>
              );
            })}
          </div>
        </nav>

        {/* Collapse Toggle Button */}
        <div className="mt-4 pt-4 border-t border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggle}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full cursor-pointer",
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
