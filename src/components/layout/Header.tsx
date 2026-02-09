"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { QuickAddButton } from "./QuickAddButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { HelpMenu } from "./HelpMenu";
import { AlertBadge } from "@/components/alerts/AlertBadge";
import { WhatsNewDrawer } from "@/components/changelog/WhatsNewDrawer";
import { featureFlags } from "@/config/feature-flags";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Breadcrumb, type BreadcrumbItem } from "./Breadcrumb";
import { FYSelector } from "./FYSelector";

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/discover": "Discover",
  "/alerts": "Alerts",
  "/portfolio": "Portfolio",
  "/properties": "Properties",
  "/properties/new": "Add Property",
  "/transactions": "Transactions",
  "/transactions/new": "Add Transaction",
  "/transactions/review": "Review Transactions",
  "/reports": "Reports",
  "/reports/tax": "Tax Report",
  "/reports/tax-position": "Tax Position",
  "/reports/forecast": "Cash Flow Forecast",
  "/reports/cgt": "Capital Gains Tax",
  "/reports/portfolio": "Portfolio Dashboard",
  "/reports/export": "Accountant Export",
  "/reports/mytax": "MyTax Export",
  "/reports/yoy-comparison": "Year-over-Year",
  "/reports/audit-checks": "Audit Checks",
  "/reports/scenarios": "Scenarios",
  "/reports/share": "Portfolio Shares",
  "/reports/compliance": "Compliance",
  "/reports/brokers": "Broker Portal",
  "/banking": "Banking",
  "/banking/connect": "Connect Bank",
  "/loans": "Loans",
  "/loans/new": "Add Loan",
  "/loans/compare": "Compare Loans",
  "/emails": "Emails",
  "/tasks": "Tasks",
  "/entities": "Entities",
  "/entities/new": "Add Entity",
  "/export": "Export",
  "/settings/notifications": "Notifications",
  "/settings/refinance-alerts": "Refinance Alerts",
  "/settings/email-connections": "Email Connections",
  "/settings/mobile": "Mobile App",
  "/settings/team": "Team",
  "/settings/audit-log": "Audit Log",
  "/settings/billing": "Billing",
  "/settings/integrations": "Integrations",
  "/settings/loan-packs": "Loan Packs",
  "/settings/feature-requests": "Feature Requests",
  "/settings/support": "Support",
  "/settings/support-admin": "Support Admin",
  "/settings/advisors": "Advisors",
  "/settings/referrals": "Referrals",
};

const parentRoutes: Record<string, string> = {
  "/properties/new": "/properties",
  "/transactions/new": "/transactions",
  "/transactions/review": "/transactions",
  "/reports/tax": "/reports",
  "/reports/tax-position": "/reports",
  "/reports/forecast": "/reports",
  "/reports/cgt": "/reports",
  "/reports/portfolio": "/reports",
  "/reports/export": "/reports",
  "/reports/mytax": "/reports",
  "/reports/yoy-comparison": "/reports",
  "/reports/audit-checks": "/reports",
  "/reports/scenarios": "/reports",
  "/reports/share": "/reports",
  "/reports/compliance": "/reports",
  "/reports/brokers": "/reports",
  "/banking/connect": "/banking",
  "/loans/new": "/loans",
  "/loans/compare": "/loans",
  "/entities/new": "/entities",
};

function getPageTitle(pathname: string): string {
  if (routeTitles[pathname]) return routeTitles[pathname];

  if (/^\/properties\/[^/]+$/.test(pathname)) return "Property";
  if (/^\/properties\/[^/]+\/edit$/.test(pathname)) return "Edit Property";
  if (/^\/properties\/[^/]+\/documents$/.test(pathname)) return "Documents";
  if (/^\/properties\/[^/]+\/emails$/.test(pathname)) return "Emails";
  if (/^\/properties\/[^/]+\/tasks$/.test(pathname)) return "Tasks";
  if (/^\/properties\/[^/]+\/compliance$/.test(pathname)) return "Compliance";
  if (/^\/properties\/[^/]+\/valuation$/.test(pathname)) return "Valuation";
  if (/^\/properties\/[^/]+\/settlement$/.test(pathname)) return "Settlement";
  if (/^\/transactions\/[^/]+\/edit$/.test(pathname)) return "Edit Transaction";
  if (/^\/loans\/[^/]+/.test(pathname)) return "Loan";
  if (/^\/entities\/[^/]+/.test(pathname)) return "Entity";
  if (/^\/emails\/[^/]+$/.test(pathname)) return "Email";
  if (/^\/reports\/scenarios\/[^/]+$/.test(pathname)) return "Scenario";
  if (/^\/reports\/brokers\/[^/]+$/.test(pathname)) return "Broker Report";
  if (pathname.startsWith("/settings")) return "Settings";

  return "Dashboard";
}

function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const title = getPageTitle(pathname);

  if (parentRoutes[pathname]) {
    const parentPath = parentRoutes[pathname];
    const parentTitle = routeTitles[parentPath] || "Settings";
    return [{ label: parentTitle, href: parentPath }, { label: title }];
  }

  if (pathname.startsWith("/properties/")) {
    const segments = pathname.split("/");
    const items: BreadcrumbItem[] = [{ label: "Properties", href: "/properties" }];
    if (segments.length >= 3) {
      const propertyPath = `/properties/${segments[2]}`;
      if (segments.length > 3) {
        items.push({ label: "Property", href: propertyPath });
        items.push({ label: title });
      } else {
        items.push({ label: title });
      }
    }
    return items;
  }

  if (pathname.startsWith("/transactions/") && pathname !== "/transactions/new" && pathname !== "/transactions/review") {
    return [{ label: "Transactions", href: "/transactions" }, { label: title }];
  }

  if (pathname.startsWith("/loans/") && pathname !== "/loans/new" && pathname !== "/loans/compare") {
    return [{ label: "Loans", href: "/loans" }, { label: title }];
  }

  if (pathname.startsWith("/entities/") && pathname !== "/entities/new") {
    return [{ label: "Entities", href: "/entities" }, { label: title }];
  }

  if (pathname.startsWith("/emails/") && pathname !== "/emails") {
    return [{ label: "Emails", href: "/emails" }, { label: title }];
  }

  if (pathname.startsWith("/reports/scenarios/")) {
    return [
      { label: "Reports", href: "/reports" },
      { label: "Scenarios", href: "/reports/scenarios" },
      { label: title },
    ];
  }

  if (pathname.startsWith("/reports/brokers/")) {
    return [
      { label: "Reports", href: "/reports" },
      { label: "Broker Portal", href: "/reports/brokers" },
      { label: title },
    ];
  }

  if (pathname.startsWith("/settings/")) {
    return [{ label: "Settings" }, { label: title }];
  }

  return [];
}

function UserMenu() {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  if (!session?.user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-full">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
              {(session.user.name?.[0] ?? session.user.email[0]).toUpperCase()}
            </div>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{session.user.name}</span>
            <span className="text-xs text-muted-foreground">{session.user.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Header() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const pageTitle = getPageTitle(pathname ?? "");
  const breadcrumbs = getBreadcrumbs(pathname ?? "");

  return (
    <>
      <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {breadcrumbs.length > 0 ? (
            <Breadcrumb items={breadcrumbs} />
          ) : (
            <h1 className="text-lg font-semibold truncate">{pageTitle}</h1>
          )}
        </div>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-3 flex-shrink-0" data-tour="quick-actions">
            {featureFlags.fySelector && <FYSelector />}
            {featureFlags.helpMenu && <HelpMenu onWhatsNewClick={() => setDrawerOpen(true)} />}
            <AlertBadge />
            {featureFlags.quickAdd && <QuickAddButton />}
            <UserMenu />
          </div>
        </TooltipProvider>
      </header>
      {featureFlags.whatsNew && (
        <WhatsNewDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}
