"use client";

import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import {
  Mail,
  MailOpen,
  ShieldAlert,
  Check,
  X,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export default function PropertyEmailsPage() {
  const params = useParams();
  const propertyId = params?.id as string;

  const [newSenderPattern, setNewSenderPattern] = useState("");
  const [newSenderLabel, setNewSenderLabel] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: emailData, isLoading, refetch } = trpc.email.list.useQuery({
    propertyId,
    limit: 50,
  });
  const { data: addressData } = trpc.email.getForwardingAddress.useQuery({
    propertyId,
  });
  const { data: senders, refetch: refetchSenders } =
    trpc.email.listSenders.useQuery({ propertyId });
  const { data: unreadCount } = trpc.email.getUnreadCount.useQuery({
    propertyId,
  });

  const markRead = trpc.email.markRead.useMutation({
    onSuccess: () => refetch(),
  });
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => {
      refetch();
      refetchSenders();
    },
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });
  const addSender = trpc.email.addSender.useMutation({
    onSuccess: () => {
      refetchSenders();
      setNewSenderPattern("");
      setNewSenderLabel("");
    },
  });
  const removeSender = trpc.email.removeSender.useMutation({
    onSuccess: () => refetchSenders(),
  });
  const regenerateAddress = trpc.email.regenerateForwardingAddress.useMutation({
    onSuccess: () => refetch(),
  });

  const handleCopy = () => {
    if (addressData?.address) {
      navigator.clipboard.writeText(addressData.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Forwarding Address Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Email Forwarding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Forward property emails to this address to see them here:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono">
                {addressData?.address ?? "Loading..."}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="w-4 h-4 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (
                    confirm(
                      "Regenerate address? The old address will stop working."
                    )
                  ) {
                    regenerateAddress.mutate({ propertyId });
                  }
                }}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Approved Senders */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              Approved Senders ({senders?.length ?? 0})
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Only emails from approved senders are processed. Others are
              quarantined for your review.
            </p>

            {senders && senders.length > 0 && (
              <div className="space-y-1 mb-3">
                {senders.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-muted/50 rounded px-3 py-1.5 text-sm"
                  >
                    <div>
                      <span className="font-mono">{s.emailPattern}</span>
                      {s.label && (
                        <span className="text-muted-foreground ml-2">
                          ({s.label})
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSender.mutate({ id: s.id })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="email@example.com or *@domain.com"
                value={newSenderPattern}
                onChange={(e) => setNewSenderPattern(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Label (optional)"
                value={newSenderLabel}
                onChange={(e) => setNewSenderLabel(e.target.value)}
                className="w-40"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!newSenderPattern.trim()}
                onClick={() =>
                  addSender.mutate({
                    propertyId,
                    emailPattern: newSenderPattern,
                    label: newSenderLabel || undefined,
                  })
                }
              >
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Inbox
            {unreadCount ? (
              <Badge variant="secondary" className="ml-2">
                {unreadCount} unread
              </Badge>
            ) : null}
          </h2>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading...
          </div>
        ) : !emailData?.emails.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No emails yet. Forward emails to the address above.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {emailData.emails.map((email) => (
              <Card
                key={email.id}
                className={`hover:bg-accent/50 transition-colors ${
                  !email.isRead ? "border-l-4 border-l-primary" : ""
                }`}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (!email.isRead) {
                          markRead.mutate({ ids: [email.id] });
                        }
                      }}
                    >
                      {email.isRead ? (
                        <MailOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                      ) : (
                        <Mail className="w-4 h-4 text-primary shrink-0" />
                      )}
                      <div className="min-w-0">
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
    </div>
  );
}
