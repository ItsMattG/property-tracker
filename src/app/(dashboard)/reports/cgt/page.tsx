"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Building2, DollarSign } from "lucide-react";
import { RecordSaleDialog } from "@/components/cgt/RecordSaleDialog";

type StatusFilter = "all" | "active" | "sold";

export default function CGTReportPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.cgt.getSummary.useQuery({
    status: statusFilter,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Capital Gains Tax</h2>
          <p className="text-muted-foreground">Track cost base and CGT liability</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Capital Gains Tax</h2>
          <p className="text-muted-foreground">Track cost base and CGT liability</p>
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totals.activeCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sold Properties</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totals.soldCount ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost Base (Active)</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data?.totals.totalCostBase ?? 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Property List */}
      <div className="space-y-4">
        {data?.properties.map((property) => (
          <Card key={property.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{property.address}</h3>
                    <Badge variant={property.status === "sold" ? "secondary" : "default"}>
                      {property.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {property.suburb}, {property.state}
                  </p>
                </div>

                {property.status === "active" ? (
                  <Button
                    variant="outline"
                    onClick={() => setSelectedPropertyId(property.id)}
                  >
                    Record Sale
                  </Button>
                ) : (
                  <Link href={`/reports/cgt/${property.id}`}>
                    <Button variant="outline">View Sale Details</Button>
                  </Link>
                )}
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Price</p>
                  <p className="font-medium">{formatCurrency(property.purchasePrice)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contract Date</p>
                  <p className="font-medium">{property.purchaseDate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cost Base</p>
                  <p className="font-medium">{formatCurrency(property.costBase)}</p>
                </div>

                {property.sale && (
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {property.sale.capitalGain >= 0 ? "Capital Gain" : "Capital Loss"}
                    </p>
                    <p className={`font-medium flex items-center gap-1 ${
                      property.sale.capitalGain >= 0 ? "text-green-600" : "text-red-600"
                    }`}>
                      {property.sale.capitalGain >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatCurrency(Math.abs(property.sale.capitalGain))}
                      {property.sale.heldOverTwelveMonths && property.sale.capitalGain > 0 && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (50% discount: {formatCurrency(property.sale.discountedGain ?? 0)})
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {data?.properties.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No properties found</h3>
              <p className="text-muted-foreground">
                {statusFilter === "all"
                  ? "Add a property to start tracking CGT"
                  : `No ${statusFilter} properties`}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedPropertyId && (
        <RecordSaleDialog
          propertyId={selectedPropertyId}
          open={!!selectedPropertyId}
          onOpenChange={(open) => !open && setSelectedPropertyId(null)}
          onSuccess={() => {
            setSelectedPropertyId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
