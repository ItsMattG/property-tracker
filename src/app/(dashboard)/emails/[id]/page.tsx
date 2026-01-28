"use client";

import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import {
  ArrowLeft,
  Paperclip,
  Download,
  Check,
  X,
  ShieldAlert,
  FileText,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { useCallback, useEffect, useState } from "react";

export default function EmailDetailPage() {
  const params = useParams();
  const router = useRouter();
  const emailId = parseInt(params?.id as string, 10);

  const { data, isLoading, refetch } = trpc.email.get.useQuery(
    { id: emailId },
    { enabled: !isNaN(emailId) }
  );
  const markRead = trpc.email.markRead.useMutation();
  const approveSender = trpc.email.approveSender.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectEmail = trpc.email.rejectEmail.useMutation({
    onSuccess: () => refetch(),
  });
  const acceptMatch = trpc.email.acceptMatch.useMutation({
    onSuccess: () => refetch(),
  });
  const rejectMatch = trpc.email.rejectMatch.useMutation({
    onSuccess: () => refetch(),
  });
  const utils = trpc.useUtils();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownload = useCallback(async (attachmentId: number) => {
    try {
      setDownloadingId(attachmentId);
      const result = await utils.email.downloadAttachment.fetch({ attachmentId });
      window.open(result.url, "_blank");
    } catch {
      // Silently handle — user sees no download
    } finally {
      setDownloadingId(null);
    }
  }, [utils]);

  // Mark as read on view
  useEffect(() => {
    if (data?.email && !data.email.isRead) {
      markRead.mutate({ ids: [data.email.id] });
    }
  }, [data?.email?.id, data?.email?.isRead]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">Loading...</div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Email not found
      </div>
    );
  }

  const { email, attachments, invoiceMatches } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Inbox
      </Button>

      {/* Quarantine banner */}
      {email.status === "quarantined" && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              <span className="text-sm">
                This email is from an unapproved sender:{" "}
                <strong>{email.fromAddress}</strong>
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveSender.mutate({ emailId: email.id })}
              >
                <Check className="w-3 h-3 mr-1" />
                Approve Sender
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => rejectEmail.mutate({ emailId: email.id })}
              >
                <X className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email header */}
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-xl">{email.subject}</CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                From: <strong>{email.fromName || email.fromAddress}</strong>
                {email.fromName && (
                  <span className="ml-1">&lt;{email.fromAddress}&gt;</span>
                )}
              </span>
              <span>
                {format(new Date(email.receivedAt), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {email.bodyHtml ? (
            <div
              className="prose dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(email.bodyHtml),
              }}
            />
          ) : (
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {email.bodyText ?? "(No content)"}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Attachments */}
      {attachments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({attachments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{att.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(att.sizeBytes / 1024).toFixed(0)} KB)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={downloadingId === att.id}
                    onClick={() => handleDownload(att.id)}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invoice Matches */}
      {invoiceMatches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invoice Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invoiceMatches.map((match) => (
                <div
                  key={match.id}
                  className="flex items-center justify-between bg-muted/50 rounded px-3 py-2"
                >
                  <div className="text-sm">
                    <span>Detected: ${match.amountDetected}</span>
                    <Badge
                      variant="outline"
                      className="ml-2"
                    >
                      {Math.round(match.confidence * 100)}% confidence
                    </Badge>
                    {match.status !== "pending" && (
                      <Badge
                        variant={
                          match.status === "accepted" ? "default" : "secondary"
                        }
                        className="ml-2"
                      >
                        {match.status}
                      </Badge>
                    )}
                  </div>
                  {match.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acceptMatch.mutate({ id: match.id })}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => rejectMatch.mutate({ id: match.id })}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
