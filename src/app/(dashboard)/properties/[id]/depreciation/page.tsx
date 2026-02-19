"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { trpc } from "@/lib/trpc/client";
import { formatCurrency } from "@/lib/utils";
import { getErrorMessage } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────

interface AssetFormState {
  assetName: string;
  category: "plant_equipment" | "capital_works";
  originalCost: string;
  effectiveLife: string;
  method: "diminishing_value" | "prime_cost";
  purchaseDate: string;
}

interface CapitalWorksFormState {
  description: string;
  constructionDate: string;
  constructionCost: string;
  claimStartDate: string;
}

const INITIAL_ASSET_FORM: AssetFormState = {
  assetName: "",
  category: "plant_equipment",
  originalCost: "",
  effectiveLife: "",
  method: "diminishing_value",
  purchaseDate: "",
};

const INITIAL_CW_FORM: CapitalWorksFormState = {
  description: "",
  constructionDate: "",
  constructionCost: "",
  claimStartDate: "",
};

const DEFAULT_VISIBLE_YEARS = 6; // Current FY + 5
const EXTENDED_VISIBLE_YEARS = 11; // Current FY + 10

/** Format financial year integer as "FY2025-26". */
function formatFY(fy: number): string {
  return `FY${fy - 1}-${String(fy).slice(2)}`;
}

// ─── Page Component ───────────────────────────────────────────────

export default function PropertyDepreciationPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params?.id as string;

  // ── State ──────────────────────────────────────────────────────
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [cwDialogOpen, setCwDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "asset" | "capitalWorks";
    id: string;
    name: string;
  } | null>(null);
  const [assetForm, setAssetForm] = useState<AssetFormState>(INITIAL_ASSET_FORM);
  const [cwForm, setCwForm] = useState<CapitalWorksFormState>(INITIAL_CW_FORM);
  const [projectionsExpanded, setProjectionsExpanded] = useState(true);
  const [showAllYears, setShowAllYears] = useState(false);

  // ── Queries ────────────────────────────────────────────────────
  const { data: property, isLoading: propertyLoading } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const { data: listData, isLoading: listLoading } = trpc.depreciation.list.useQuery(
    { propertyId },
    { enabled: !!propertyId }
  );

  const { data: projections, isLoading: projectionsLoading } =
    trpc.depreciation.getProjection.useQuery(
      { propertyId },
      { enabled: !!propertyId }
    );

  // ── Mutations ──────────────────────────────────────────────────
  const utils = trpc.useUtils();

  const invalidateAll = () => {
    utils.depreciation.list.invalidate({ propertyId });
    utils.depreciation.getProjection.invalidate({ propertyId });
  };

  const createSchedule = trpc.depreciation.createSchedule.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Depreciation schedule created");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const addAsset = trpc.depreciation.addAsset.useMutation({
    onSuccess: () => {
      invalidateAll();
      setAssetDialogOpen(false);
      setAssetForm(INITIAL_ASSET_FORM);
      toast.success("Asset added");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteAsset = trpc.depreciation.deleteAsset.useMutation({
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.success("Asset deleted");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const addCapitalWorks = trpc.depreciation.addCapitalWorks.useMutation({
    onSuccess: () => {
      invalidateAll();
      setCwDialogOpen(false);
      setCwForm(INITIAL_CW_FORM);
      toast.success("Capital works added");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const deleteCapitalWorks = trpc.depreciation.deleteCapitalWorks.useMutation({
    onSuccess: () => {
      invalidateAll();
      setDeleteTarget(null);
      toast.success("Capital works deleted");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const claimFY = trpc.depreciation.claimFY.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Depreciation marked as claimed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const unclaimFY = trpc.depreciation.unclaimFY.useMutation({
    onSuccess: () => {
      invalidateAll();
      toast.success("Claim removed");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // ── Derived data ───────────────────────────────────────────────
  const schedules = listData?.schedules ?? [];
  const capitalWorksList = listData?.capitalWorks ?? [];
  const schedule = schedules[0]; // Use first schedule
  const allAssets = schedules.flatMap((s) => s.assets);

  const individualAssets = allAssets.filter((a) => a.poolType === "individual");
  const lowValueAssets = allAssets.filter((a) => a.poolType === "low_value");
  const immediateWriteoffs = allAssets.filter(
    (a) => a.poolType === "immediate_writeoff"
  );

  const currentFYProjection = projections?.[0];
  const thisFYDeduction = currentFYProjection?.grandTotal ?? 0;
  const totalRemainingValue = allAssets.reduce(
    (sum, a) => sum + parseFloat(a.remainingValue),
    0
  );
  const assetCount = allAssets.length;
  const capitalWorksCount = capitalWorksList.length;

  const hasSchedule = schedules.length > 0;
  const isLoading = propertyLoading || listLoading;

  // Build set of FYs that have been claimed
  const claimedFYs = new Set(
    schedules.flatMap((s) =>
      s.assets.flatMap((a) => a.claims.map((c) => c.financialYear))
    )
  );

  // Determine how many projection rows to show
  const visibleYears = showAllYears ? EXTENDED_VISIBLE_YEARS : DEFAULT_VISIBLE_YEARS;
  const visibleProjections = projections?.slice(0, visibleYears) ?? [];
  const hasMoreProjections = (projections?.length ?? 0) > DEFAULT_VISIBLE_YEARS;

  // ── Handlers ───────────────────────────────────────────────────
  const handleCreateSchedule = () => {
    const today = new Date().toISOString().split("T")[0];
    createSchedule.mutate({ propertyId, effectiveDate: today });
  };

  const handleAddAsset = () => {
    if (!schedule) return;

    const cost = parseFloat(assetForm.originalCost);
    const life = parseFloat(assetForm.effectiveLife);

    if (!assetForm.assetName || isNaN(cost) || cost <= 0 || isNaN(life) || life <= 0) {
      toast.error("Please fill in all required fields with valid values");
      return;
    }

    addAsset.mutate({
      scheduleId: schedule.id,
      assetName: assetForm.assetName,
      category: assetForm.category,
      originalCost: cost,
      effectiveLife: life,
      method: assetForm.method,
      purchaseDate: assetForm.purchaseDate || undefined,
    });
  };

  const handleAddCapitalWorks = () => {
    const cost = parseFloat(cwForm.constructionCost);

    if (
      !cwForm.description ||
      !cwForm.constructionDate ||
      isNaN(cost) ||
      cost <= 0 ||
      !cwForm.claimStartDate
    ) {
      toast.error("Please fill in all required fields with valid values");
      return;
    }

    addCapitalWorks.mutate({
      propertyId,
      description: cwForm.description,
      constructionDate: cwForm.constructionDate,
      constructionCost: cost,
      claimStartDate: cwForm.claimStartDate,
    });
  };

  const handleDelete = () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "asset") {
      deleteAsset.mutate({ assetId: deleteTarget.id });
    } else {
      deleteCapitalWorks.mutate({ id: deleteTarget.id });
    }
  };

  // ── Loading state ──────────────────────────────────────────────
  if (propertyLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <h2 className="text-lg font-semibold">Property not found</h2>
        <p className="text-muted-foreground mt-1">
          The property you&apos;re looking for doesn&apos;t exist or you
          don&apos;t have access.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/properties")}
        >
          Back to Properties
        </Button>
      </div>
    );
  }

  // ── No schedule state ──────────────────────────────────────────
  if (!isLoading && !hasSchedule) {
    return (
      <div className="space-y-6">
        <Header property={property} />
        <EmptyState
          icon={Calculator}
          title="Set Up Depreciation Tracking"
          description="Create a depreciation schedule to start tracking plant & equipment, capital works, and low-value pool assets for this property."
          action={{
            label: "Set Up Depreciation",
            onClick: handleCreateSchedule,
          }}
        />
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <Header property={property} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="This FY Deduction"
          value={formatCurrency(thisFYDeduction)}
          isLoading={projectionsLoading}
        />
        <SummaryCard
          title="Total Remaining Value"
          value={formatCurrency(totalRemainingValue)}
          isLoading={listLoading}
        />
        <SummaryCard
          title="Assets Tracked"
          value={assetCount.toString()}
          isLoading={listLoading}
        />
        <SummaryCard
          title="Capital Works"
          value={capitalWorksCount.toString()}
          isLoading={listLoading}
        />
      </div>

      {/* Tabbed Asset Register */}
      <Tabs defaultValue="plant_equipment" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plant_equipment">
            Plant & Equipment ({individualAssets.length})
          </TabsTrigger>
          <TabsTrigger value="capital_works">
            Capital Works ({capitalWorksCount})
          </TabsTrigger>
          <TabsTrigger value="low_value_pool">
            Low-Value Pool ({lowValueAssets.length + immediateWriteoffs.length})
          </TabsTrigger>
        </TabsList>

        {/* Plant & Equipment Tab */}
        <TabsContent value="plant_equipment">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Plant & Equipment (Div 40)</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  <Upload className="h-4 w-4" />
                  Upload QS Report
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAssetDialogOpen(true)}
                  disabled={!hasSchedule}
                >
                  <Plus className="h-4 w-4" />
                  Add Asset
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <TableSkeleton rows={3} cols={7} />
              ) : individualAssets.length === 0 ? (
                <EmptyState
                  icon={Calculator}
                  title="No plant & equipment assets"
                  description="Add individual assets like appliances, carpets, and fixtures to track their depreciation."
                  action={{
                    label: "Add Asset",
                    onClick: () => setAssetDialogOpen(true),
                  }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset Name</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Effective Life</TableHead>
                      <TableHead className="text-right">This FY</TableHead>
                      <TableHead className="text-right">Remaining</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {individualAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell className="font-medium">
                          {asset.assetName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(parseFloat(asset.originalCost))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {asset.method === "diminishing_value" ? "DV" : "PC"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {parseFloat(asset.effectiveLife)} yrs
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(parseFloat(asset.yearlyDeduction))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(parseFloat(asset.remainingValue))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" disabled>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setDeleteTarget({
                                  type: "asset",
                                  id: asset.id,
                                  name: asset.assetName,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capital Works Tab */}
        <TabsContent value="capital_works">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Capital Works (Div 43)</CardTitle>
              <Button size="sm" onClick={() => setCwDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add Capital Works
              </Button>
            </CardHeader>
            <CardContent>
              {listLoading ? (
                <TableSkeleton rows={3} cols={6} />
              ) : capitalWorksList.length === 0 ? (
                <EmptyState
                  icon={Calculator}
                  title="No capital works"
                  description="Add capital works items like building construction costs to claim 2.5% per year over 40 years."
                  action={{
                    label: "Add Capital Works",
                    onClick: () => setCwDialogOpen(true),
                  }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Construction Date</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Annual (2.5%)</TableHead>
                      <TableHead className="text-right">Years Remaining</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {capitalWorksList.map((cw) => {
                      const cost = parseFloat(cw.constructionCost);
                      const annual = Math.round(cost * 0.025 * 100) / 100;
                      const constructionYear = new Date(
                        cw.constructionDate
                      ).getFullYear();
                      const currentYear = new Date().getFullYear();
                      const yearsElapsed = currentYear - constructionYear;
                      const yearsRemaining = Math.max(0, 40 - yearsElapsed);

                      return (
                        <TableRow key={cw.id}>
                          <TableCell className="font-medium">
                            {cw.description}
                          </TableCell>
                          <TableCell>
                            {new Date(cw.constructionDate).toLocaleDateString(
                              "en-AU",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(cost)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(annual)}
                          </TableCell>
                          <TableCell className="text-right">
                            {yearsRemaining} yrs
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" disabled>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "capitalWorks",
                                    id: cw.id,
                                    name: cw.description,
                                  })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low-Value Pool Tab */}
        <TabsContent value="low_value_pool">
          <Card>
            <CardHeader>
              <CardTitle>Low-Value Pool</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {listLoading ? (
                <TableSkeleton rows={3} cols={5} />
              ) : lowValueAssets.length === 0 && immediateWriteoffs.length === 0 ? (
                <EmptyState
                  icon={Calculator}
                  title="No low-value pool assets"
                  description="Assets costing $1,000 or less are automatically added to the low-value pool. Assets under $300 are instantly written off."
                />
              ) : (
                <>
                  {/* Low-Value Pool Assets */}
                  {lowValueAssets.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Pooled Assets (18.75% / 37.5%)
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Asset Name</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">
                              Opening WDV
                            </TableHead>
                            <TableHead className="text-right">
                              This FY Deduction
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lowValueAssets.map((asset) => (
                            <TableRow key={asset.id}>
                              <TableCell className="font-medium">
                                {asset.assetName}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(parseFloat(asset.originalCost))}
                              </TableCell>
                              <TableCell className="text-right">
                                {asset.openingWrittenDownValue
                                  ? formatCurrency(
                                      parseFloat(asset.openingWrittenDownValue)
                                    )
                                  : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(
                                  parseFloat(asset.yearlyDeduction)
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "asset",
                                      id: asset.id,
                                      name: asset.assetName,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Immediate Write-offs */}
                  {immediateWriteoffs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Instant Write-offs (under $300)
                      </h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Asset Name</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="text-right">
                              Write-off Amount
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {immediateWriteoffs.map((asset) => (
                            <TableRow key={asset.id}>
                              <TableCell className="font-medium">
                                {asset.assetName}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(parseFloat(asset.originalCost))}
                              </TableCell>
                              <TableCell className="text-right">
                                {formatCurrency(parseFloat(asset.originalCost))}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() =>
                                    setDeleteTarget({
                                      type: "asset",
                                      id: asset.id,
                                      name: asset.assetName,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Year-by-Year Projections */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Year-by-Year Projections</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectionsExpanded((prev) => !prev)}
          >
            {projectionsExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            {projectionsExpanded ? "Collapse" : "Expand"}
          </Button>
        </CardHeader>
        {projectionsExpanded && (
          <CardContent>
            {projectionsLoading ? (
              <TableSkeleton rows={6} cols={6} />
            ) : !projections || projections.length === 0 ? (
              <EmptyState
                icon={Calculator}
                title="No projections available"
                description="Add assets to see depreciation projections."
              />
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>FY</TableHead>
                      <TableHead className="text-right">Div 40</TableHead>
                      <TableHead className="text-right">Div 43</TableHead>
                      <TableHead className="text-right">Low-Value Pool</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleProjections.map((row) => {
                      const isClaimed = claimedFYs.has(row.financialYear);
                      const isMutating =
                        (claimFY.isPending &&
                          claimFY.variables?.financialYear === row.financialYear) ||
                        (unclaimFY.isPending &&
                          unclaimFY.variables?.financialYear === row.financialYear);

                      return (
                        <TableRow
                          key={row.financialYear}
                          className={
                            isClaimed
                              ? "bg-green-50 dark:bg-green-950/20"
                              : undefined
                          }
                        >
                          <TableCell className="font-medium">
                            {formatFY(row.financialYear)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.div40Total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.div43Total)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.lowValuePoolTotal)}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(row.grandTotal)}
                          </TableCell>
                          <TableCell className="text-right">
                            {isMutating ? (
                              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                            ) : isClaimed ? (
                              <div className="flex items-center justify-end gap-2">
                                <Badge variant="default" className="bg-green-600">
                                  Claimed
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto px-1 py-0 text-xs text-muted-foreground"
                                  onClick={() => {
                                    if (!schedule) return;
                                    unclaimFY.mutate({
                                      scheduleId: schedule.id,
                                      financialYear: row.financialYear,
                                    });
                                  }}
                                >
                                  Unclaim
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={!schedule || row.grandTotal === 0}
                                onClick={() => {
                                  if (!schedule) return;
                                  claimFY.mutate({
                                    scheduleId: schedule.id,
                                    financialYear: row.financialYear,
                                    amounts: [
                                      {
                                        assetId: null,
                                        amount: row.grandTotal,
                                      },
                                    ],
                                  });
                                }}
                              >
                                Mark as Claimed
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {hasMoreProjections && (
                  <div className="mt-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAllYears((prev) => !prev)}
                    >
                      {showAllYears ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show More (10 years)
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* Add Asset Dialog */}
      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Asset</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="assetName">Asset Name</Label>
              <Input
                id="assetName"
                placeholder="e.g. Hot Water System"
                value={assetForm.assetName}
                onChange={(e) =>
                  setAssetForm((prev) => ({
                    ...prev,
                    assetName: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={assetForm.category}
                onValueChange={(val: "plant_equipment" | "capital_works") =>
                  setAssetForm((prev) => ({ ...prev, category: val }))
                }
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plant_equipment">
                    Plant & Equipment
                  </SelectItem>
                  <SelectItem value="capital_works">Capital Works</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="originalCost">Original Cost ($)</Label>
                <Input
                  id="originalCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={assetForm.originalCost}
                  onChange={(e) =>
                    setAssetForm((prev) => ({
                      ...prev,
                      originalCost: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="effectiveLife">Effective Life (years)</Label>
                <Input
                  id="effectiveLife"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g. 10"
                  value={assetForm.effectiveLife}
                  onChange={(e) =>
                    setAssetForm((prev) => ({
                      ...prev,
                      effectiveLife: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="method">Depreciation Method</Label>
                <Select
                  value={assetForm.method}
                  onValueChange={(
                    val: "diminishing_value" | "prime_cost"
                  ) => setAssetForm((prev) => ({ ...prev, method: val }))}
                >
                  <SelectTrigger id="method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diminishing_value">
                      Diminishing Value
                    </SelectItem>
                    <SelectItem value="prime_cost">Prime Cost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purchaseDate">Purchase Date (optional)</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={assetForm.purchaseDate}
                  onChange={(e) =>
                    setAssetForm((prev) => ({
                      ...prev,
                      purchaseDate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssetDialogOpen(false);
                setAssetForm(INITIAL_ASSET_FORM);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleAddAsset} disabled={addAsset.isPending}>
              {addAsset.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Capital Works Dialog */}
      <Dialog open={cwDialogOpen} onOpenChange={setCwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Capital Works</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="cwDescription">Description</Label>
              <Input
                id="cwDescription"
                placeholder="e.g. Building construction"
                value={cwForm.description}
                onChange={(e) =>
                  setCwForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="constructionDate">Construction Date</Label>
                <Input
                  id="constructionDate"
                  type="date"
                  value={cwForm.constructionDate}
                  onChange={(e) =>
                    setCwForm((prev) => ({
                      ...prev,
                      constructionDate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="constructionCost">Construction Cost ($)</Label>
                <Input
                  id="constructionCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cwForm.constructionCost}
                  onChange={(e) =>
                    setCwForm((prev) => ({
                      ...prev,
                      constructionCost: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="claimStartDate">Claim Start Date</Label>
              <Input
                id="claimStartDate"
                type="date"
                value={cwForm.claimStartDate}
                onChange={(e) =>
                  setCwForm((prev) => ({
                    ...prev,
                    claimStartDate: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCwDialogOpen(false);
                setCwForm(INITIAL_CW_FORM);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCapitalWorks}
              disabled={addCapitalWorks.isPending}
            >
              {addCapitalWorks.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Save Capital Works
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently remove the{" "}
              {deleteTarget?.type === "asset" ? "asset" : "capital works entry"}{" "}
              and all associated depreciation data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
            >
              {(deleteAsset.isPending || deleteCapitalWorks.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────

interface HeaderProps {
  property: { address: string; suburb: string; id: string };
}

function Header({ property }: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/properties/${property.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Depreciation</h1>
          <p className="text-muted-foreground">
            {property.address}, {property.suburb}
          </p>
        </div>
      </div>
    </div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string;
  isLoading: boolean;
}

function SummaryCard({ title, value, isLoading }: SummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <p className="text-2xl font-bold">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface TableSkeletonProps {
  rows: number;
  cols: number;
}

function TableSkeleton({ rows, cols }: TableSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }, (_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
