"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import {
  UserPlus,
  UserMinus,
  Shield,
  CheckCircle,
  XCircle,
  Link,
  Unlink,
} from "lucide-react";

const actionIcons: Record<string, React.ElementType> = {
  member_invited: UserPlus,
  member_removed: UserMinus,
  role_changed: Shield,
  invite_accepted: CheckCircle,
  invite_declined: XCircle,
  bank_connected: Link,
  bank_disconnected: Unlink,
};

const actionLabels: Record<string, string> = {
  member_invited: "Invited member",
  member_removed: "Removed member",
  role_changed: "Changed role",
  invite_accepted: "Accepted invite",
  invite_declined: "Declined invite",
  bank_connected: "Connected bank",
  bank_disconnected: "Disconnected bank",
};

export default function AuditLogPage() {
  const { data: context } = trpc.team.getContext.useQuery();
  const { data: entries, isLoading } = trpc.team.getAuditLog.useQuery({
    limit: 50,
    offset: 0,
  });

  if (!context?.permissions.canViewAuditLog) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-muted-foreground">
          You do not have access to view the audit log.
        </p>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <p className="text-muted-foreground">
          Track important changes to your portfolio
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-4">
              {entries.map((entry) => {
                const Icon = actionIcons[entry.action] || Shield;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-3 border rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {actionLabels[entry.action] || entry.action}
                        </p>
                        {entry.targetEmail && (
                          <Badge variant="outline">{entry.targetEmail}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        by {entry.actor?.name || entry.actor?.email || "Unknown"} •{" "}
                        {formatDate(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No activity recorded yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
