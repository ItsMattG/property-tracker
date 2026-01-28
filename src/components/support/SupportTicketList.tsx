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
import { NewTicketModal } from "./NewTicketModal";
import { ChevronDown, Loader2, Plus, Send, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on You",
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

export function SupportTicketList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [replyContent, setReplyContent] = useState<Record<string, string>>({});

  const { data: tickets, isLoading, refetch } = trpc.supportTickets.list.useQuery(
    statusFilter !== "all" ? { status: statusFilter } : undefined,
  );
  const addNote = trpc.supportTickets.addNote.useMutation({
    onSuccess: () => refetch(),
  });

  const handleReply = (ticketId: string) => {
    const content = replyContent[ticketId]?.trim();
    if (!content) return;
    addNote.mutate({ ticketId, content });
    setReplyContent((prev) => ({ ...prev, [ticketId]: "" }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Filter:</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="waiting_on_customer">Waiting on You</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShowNewTicket(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {tickets && tickets.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              No support tickets found. Create one if you need help.
            </p>
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

                {ticket.notes.length > 0 && (
                  <div className="space-y-3 border-t pt-4">
                    <p className="text-sm font-medium">Conversation</p>
                    {ticket.notes.map((note) => (
                      <div key={note.id} className="text-sm bg-muted/50 rounded-lg p-3">
                        <p className="whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(note.createdAt).toLocaleDateString("en-AU")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {ticket.status !== "closed" && ticket.status !== "resolved" && (
                  <div className="flex gap-2 border-t pt-4">
                    <Textarea
                      placeholder="Add a reply..."
                      value={replyContent[ticket.id] ?? ""}
                      onChange={(e) =>
                        setReplyContent((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      className="min-h-[60px]"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleReply(ticket.id)}
                      disabled={!replyContent[ticket.id]?.trim() || addNote.isPending}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      <NewTicketModal
        open={showNewTicket}
        onOpenChange={setShowNewTicket}
        onCreated={() => refetch()}
      />
    </div>
  );
}
