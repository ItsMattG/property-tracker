"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { Mail, MailOpen, ShieldAlert, Check, X, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useMemo } from "react";

export default function GlobalInboxPage() {
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: propertiesList } = trpc.property.list.useQuery();
  const { data, isLoading, refetch } = trpc.email.list.useQuery({
    propertyId: propertyFilter !== "all" ? propertyFilter : undefined,
    status:
      statusFilter !== "all"
        ? (statusFilter as "approved" | "quarantined")
        : undefined,
    limit: 50,
  });
  const markRead = trpc.email.markRead.useMutation({ onSuccess: () => refetch() });
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });

  const propertyMap = new Map(
    (propertiesList ?? []).map((p) => [p.id, `${p.address}, ${p.suburb}`])
  );

  // Group emails by thread
  const threadGroups = useMemo(() => {
    if (!data?.emails) return [];

    const groups = new Map<string, typeof data.emails>();
    const ungrouped: typeof data.emails = [];

    for (const email of data.emails) {
      if (email.threadId) {
        const existing = groups.get(email.threadId) || [];
        existing.push(email);
        groups.set(email.threadId, existing);
      } else {
        ungrouped.push(email);
      }
    }

    type EmailWithThread = (typeof data.emails)[0] & {
      threadCount?: number;
      isThreadChild?: boolean;
    };

    const result: EmailWithThread[] = [];

    for (const [, emails] of groups) {
      const sorted = emails.sort(
        (a, b) =>
          new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
      );
      result.push({ ...sorted[0], threadCount: sorted.length });
      for (let i = 1; i < sorted.length; i++) {
        result.push({ ...sorted[i], isThreadChild: true });
      }
    }

    for (const email of ungrouped) {
      result.push(email);
    }

    result.sort(
      (a, b) =>
        new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    return result;
  }, [data?.emails]);

  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(
    new Set()
  );

  const toggleThread = (threadId: string) => {
    setExpandedThreads((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Emails</h1>
        <p className="text-muted-foreground">
          Forwarded property emails from your approved senders
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-full sm:w-[250px]">
            <SelectValue placeholder="All properties" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All properties</SelectItem>
            {(propertiesList ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address}, {p.suburb}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="quarantined">Quarantined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          Loading emails...
        </div>
      ) : !data?.emails.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">No emails yet</p>
            <p>
              Set up email forwarding on your properties to see emails here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threadGroups
            .filter(
              (email) =>
                !email.isThreadChild ||
                (email.threadId && expandedThreads.has(email.threadId))
            )
            .map((email) => (
            <Card
              key={email.id}
              className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                !email.isRead ? "border-l-4 border-l-primary" : ""
              }`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0"
                    onClick={() => {
                      if (!email.isRead) {
                        markRead.mutate({ ids: [email.id] });
                      }
                    }}
                  >
                    {email.threadCount && email.threadCount > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (email.threadId) toggleThread(email.threadId);
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground shrink-0"
                      >
                        {email.threadId && expandedThreads.has(email.threadId) ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span className="bg-secondary text-secondary-foreground rounded-full px-1.5 py-0.5 text-xs">
                          {email.threadCount}
                        </span>
                      </button>
                    )}
                    {email.isThreadChild && (
                      <div className="w-4 border-l-2 border-muted-foreground/30 ml-1 shrink-0" />
                    )}
                    {email.isRead ? (
                      <MailOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="w-4 h-4 text-primary shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm truncate ${
                            !email.isRead ? "font-semibold" : ""
                          }`}
                        >
                          {email.fromName || email.fromAddress}
                        </span>
                        {email.status === "quarantined" && (
                          <Badge
                            variant="outline"
                            className="text-amber-600 border-amber-300"
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" />
                            Quarantined
                          </Badge>
                        )}
                      </div>
                      <p
                        className={`text-sm truncate ${
                          !email.isRead
                            ? "text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.propertyId ? (propertyMap.get(email.propertyId) ?? "Unknown property") : "Unassigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    {email.status === "quarantined" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            approveSender.mutate({ emailId: email.id })
                          }
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            rejectEmail.mutate({ emailId: email.id })
                          }
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(email.receivedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
