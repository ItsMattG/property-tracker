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
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

type StatusFilter = "all" | "new" | "investigating" | "fixed" | "wont_fix";
type SeverityFilter = "all" | "low" | "medium" | "high" | "critical";

const severityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  investigating: "bg-yellow-100 text-yellow-800",
  fixed: "bg-green-100 text-green-800",
  wont_fix: "bg-gray-100 text-gray-800",
};

type BugReport = {
  id: string;
  description: string;
  stepsToReproduce: string | null;
  severity: string;
  browserInfo: unknown;
  currentPage: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
};

export function BugReportList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedBug, setSelectedBug] = useState<BugReport | null>(null);
  const [newStatus, setNewStatus] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");

  const utils = trpc.useUtils();

  const { data: bugs, isLoading, error } = trpc.feedback.listBugs.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    severity: severityFilter === "all" ? undefined : severityFilter,
  });

  const updateMutation = trpc.feedback.updateBugStatus.useMutation({
    onSuccess: () => {
      utils.feedback.listBugs.invalidate();
      setSelectedBug(null);
    },
  });

  const openBugDetail = (bug: BugReport) => {
    setSelectedBug(bug);
    setNewStatus(bug.status);
    setAdminNotes(bug.adminNotes ?? "");
  };

  const handleUpdate = () => {
    if (!selectedBug) return;
    updateMutation.mutate({
      id: selectedBug.id,
      status: newStatus as "new" | "investigating" | "fixed" | "wont_fix",
      adminNotes: adminNotes || undefined,
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
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="fixed">Fixed</SelectItem>
            <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as SeverityFilter)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : bugs?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No bug reports found.
        </div>
      ) : (
        <div className="space-y-4">
          {bugs?.map((bug) => (
            <Card
              key={bug.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => openBugDetail(bug as BugReport)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-medium">
                  {bug.description.slice(0, 100)}
                  {bug.description.length > 100 && "..."}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge className={severityColors[bug.severity]}>
                    {bug.severity}
                  </Badge>
                  <Badge className={statusColors[bug.status]}>
                    {bug.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <span>{bug.userName ?? "Anonymous"}</span>
                  <span className="mx-2">-</span>
                  <span>{bug.userEmail}</span>
                  <span className="mx-2">-</span>
                  <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                  {bug.currentPage && (
                    <>
                      <span className="mx-2">-</span>
                      <span>{bug.currentPage}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedBug} onOpenChange={() => setSelectedBug(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bug Report Details</DialogTitle>
            <DialogDescription>
              Review and update the status of this bug report.
            </DialogDescription>
          </DialogHeader>

          {selectedBug && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Description</h4>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedBug.description}
                </p>
              </div>

              {selectedBug.stepsToReproduce && (
                <div>
                  <h4 className="font-medium mb-1">Steps to Reproduce</h4>
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedBug.stepsToReproduce}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-1">Reported By</h4>
                  <p className="text-sm">
                    {selectedBug.userName ?? "Anonymous"} ({selectedBug.userEmail})
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Page</h4>
                  <p className="text-sm">{selectedBug.currentPage ?? "N/A"}</p>
                </div>
              </div>

              {selectedBug.browserInfo && (
                <div>
                  <h4 className="font-medium mb-1">Browser Info</h4>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(selectedBug.browserInfo, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <h4 className="font-medium mb-1">Update Status</h4>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <h4 className="font-medium mb-1">Admin Notes</h4>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add internal notes about this bug..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedBug(null)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
