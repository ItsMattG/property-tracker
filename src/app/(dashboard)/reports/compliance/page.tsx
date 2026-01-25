"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComplianceTable } from "@/components/compliance/ComplianceTable";
import { CheckCircle2, AlertTriangle, Clock, AlertCircle } from "lucide-react";

export default function ComplianceCalendarPage() {
  const { data, isLoading } = trpc.compliance.getPortfolioCompliance.useQuery();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Compliance Calendar</h2>
          <p className="text-muted-foreground">
            Track compliance requirements across your portfolio
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 rounded-lg bg-muted animate-pulse"
            />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // Handle empty state when no properties exist
  if (!data || data.summary.total === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Compliance Calendar</h2>
          <p className="text-muted-foreground">
            Track compliance requirements across your portfolio
          </p>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No compliance items</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Add properties to your portfolio and record compliance activities to see them here.
          </p>
        </div>
      </div>
    );
  }

  const { summary, upcomingItems, overdueItems } = data;

  // Transform items for the table component
  const transformItems = (items: typeof upcomingItems) =>
    items.map((item) => ({
      propertyId: item.propertyId,
      propertyAddress: item.propertyAddress,
      requirementName: item.requirement.name,
      nextDueAt: item.nextDueAt,
      status: item.status,
    }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Compliance Calendar</h2>
        <p className="text-muted-foreground">
          Track compliance requirements across your portfolio
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliant</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.compliant}</div>
            <p className="text-xs text-muted-foreground">
              items up to date
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.upcoming}</div>
            <p className="text-xs text-muted-foreground">
              due within 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.dueSoon}</div>
            <p className="text-xs text-muted-foreground">
              due within 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.overdue}</div>
            <p className="text-xs text-muted-foreground">
              require attention
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Items Section */}
      {overdueItems.length > 0 && (
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="bg-red-50 dark:bg-red-950/20 rounded-t-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <CardTitle className="text-red-700 dark:text-red-400">
                Overdue Items
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ComplianceTable items={transformItems(overdueItems)} />
          </CardContent>
        </Card>
      )}

      {/* Upcoming Items Section */}
      {upcomingItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Items</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTable items={transformItems(upcomingItems)} />
          </CardContent>
        </Card>
      )}

      {/* All Clear State */}
      {overdueItems.length === 0 && upcomingItems.length === 0 && summary.compliant > 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold">All compliance items are up to date</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Your portfolio is fully compliant with no upcoming or overdue items.
          </p>
        </div>
      )}
    </div>
  );
}
