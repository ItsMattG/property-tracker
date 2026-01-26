"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type StatusFilter = "all" | "open" | "planned" | "in_progress" | "shipped" | "rejected";

const statusColors: Record<string, string> = {
  open: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  shipped: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

type FeatureRequest = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  voteCount: number;
  createdAt: string;
  userName: string | null;
};

export function AdminFeatureList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedFeature, setSelectedFeature] = useState<FeatureRequest | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: features, isLoading, error } = trpc.feedback.listFeatures.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy: "votes",
  });

  const updateMutation = trpc.feedback.updateFeatureStatus.useMutation({
    onSuccess: () => {
      utils.feedback.listFeatures.invalidate();
      setSelectedFeature(null);
    },
  });

  const openFeatureDetail = (feature: FeatureRequest) => {
    setSelectedFeature(feature);
    setNewStatus(feature.status);
  };

  const handleUpdate = () => {
    if (!selectedFeature) return;
    updateMutation.mutate({
      id: selectedFeature.id,
      status: newStatus as "open" | "planned" | "in_progress" | "shipped" | "rejected",
    });
  };

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="shipped">Shipped</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : features?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No feature requests found.
        </div>
      ) : (
        <div className="space-y-4">
          {features?.map((feature) => (
            <Card
              key={feature.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openFeatureDetail(feature as FeatureRequest)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {feature.title}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{feature.voteCount} votes</span>
                  <Badge className={statusColors[feature.status]}>
                    {feature.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {feature.description}
                </p>
                <div className="mt-2 text-xs text-muted-foreground">
                  <span>{feature.userName ?? "Anonymous"}</span>
                  <span className="mx-2">-</span>
                  <span>{new Date(feature.createdAt).toLocaleDateString()}</span>
                  <span className="mx-2">-</span>
                  <span className="capitalize">{feature.category}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedFeature} onOpenChange={() => setSelectedFeature(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Feature Request Details</DialogTitle>
            <DialogDescription>
              Review and update the status of this feature request.
            </DialogDescription>
          </DialogHeader>

          {selectedFeature && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">{selectedFeature.title}</h4>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedFeature.description}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Category:</span>{" "}
                  <span className="capitalize">{selectedFeature.category}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Votes:</span>{" "}
                  {selectedFeature.voteCount}
                </div>
                <div>
                  <span className="text-muted-foreground">By:</span>{" "}
                  {selectedFeature.userName ?? "Anonymous"}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-1">Update Status</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="shipped">Shipped</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedFeature(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
