"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown, Loader2, Send, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  waiting_on_customer: "bg-purple-100 text-purple-800",
  resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
};

const urgencyColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-amber-100 text-amber-800",
  critical: "bg-red-100 text-red-800",
};

const categoryLabels: Record<string, string> = {
  bug: "Bug",
  question: "Question",
  feature_request: "Feature Request",
  account_issue: "Account Issue",
};

export function AdminTicketList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [noteContent, setNoteContent] = useState<Record<string, string>>({});
  const [noteInternal, setNoteInternal] = useState<Record<string, boolean>>({});

  const { data: tickets, isLoading, refetch } = trpc.supportTickets.adminList.useQuery({
    status: statusFilter !== "all" ? statusFilter : undefined,
    urgency: urgencyFilter !== "all" ? urgencyFilter : undefined,
  });

  const updateStatus = trpc.supportTickets.updateStatus.useMutation({
    onSuccess: () => refetch(),
  });

  const addNote = trpc.supportTickets.addAdminNote.useMutation({
    onSuccess: () => refetch(),
  });

  const handleAddNote = (ticketId: string) => {
    const content = noteContent[ticketId]?.trim();
    if (!content) return;
    addNote.mutate({
      ticketId,
      content,
      isInternal: noteInternal[ticketId] ?? false,
    });
    setNoteContent((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_on_customer">Waiting</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Urgency:</span>
          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">No tickets found.</p>
          </CardContent>
        </Card>
      )}

      {tickets?.map((ticket) => (
        <Collapsible key={ticket.id}>
          <Card>
            <CollapsibleTrigger className="w-full text-left">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                  <Ticket className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {ticket.displayId}
                      </span>
                      <CardTitle className="text-base">{ticket.subject}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {categoryLabels[ticket.category] ?? ticket.category}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", urgencyColors[ticket.urgency])}>
                        {ticket.urgency}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.createdAt).toLocaleDateString("en-AU")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={cn("text-xs", statusColors[ticket.status])}>
                    {statusLabels[ticket.status] ?? ticket.status}
                  </Badge>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>

                {/* Status controls */}
                <div className="flex items-center gap-2 border-t pt-4">
                  <span className="text-sm text-muted-foreground">Set status:</span>
                  <Select
                    value={ticket.status}
                    onValueChange={(v) =>
                      updateStatus.mutate({
                        id: ticket.id,
                        status: v as "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed",
                      })
                    }
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="waiting_on_customer">Waiting on Customer</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                {ticket.notes.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Notes</p>
                    {ticket.notes.map((note) => (
                      <div
                        key={note.id}
                        className={cn(
                          "text-sm rounded-lg p-3",
                          note.isInternal
                            ? "bg-yellow-50 border border-yellow-200"
                            : "bg-muted/50",
                        )}
                      >
                        {note.isInternal && (
                          <p className="text-xs font-medium text-yellow-700 mb-1">Internal Note</p>
                        )}
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add note */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Add a note..."
                      value={noteContent[ticket.id] ?? ""}
                      onChange={(e) =>
                        setNoteContent((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="min-h-[60px]"
                    />
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAddNote(ticket.id)}
                        disabled={!noteContent[ticket.id]?.trim() || addNote.isPending}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={noteInternal[ticket.id] ?? false}
                      onChange={(e) =>
                        setNoteInternal((prev) => ({ ...prev, [ticket.id]: e.target.checked }))
                      }
                    />
                    Internal note (not visible to user)
                  </label>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
