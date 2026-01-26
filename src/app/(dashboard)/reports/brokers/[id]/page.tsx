"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Send,
  Copy,
  Check,
  ExternalLink,
  Mail,
  Phone,
  Building2,
  FileText,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { BrokerModal } from "@/components/broker/BrokerModal";
import { GenerateLoanPackModal } from "@/components/loanPack/GenerateLoanPackModal";

export default function BrokerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brokerId = params?.id as string;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [copiedPackId, setCopiedPackId] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: broker, isLoading, error } = trpc.broker.get.useQuery({ id: brokerId });

  const deleteMutation = trpc.broker.delete.useMutation({
    onSuccess: () => {
      toast.success("Broker deleted");
      router.push("/reports/brokers");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete broker");
    },
  });

  const revokeMutation = trpc.loanPack.revoke.useMutation({
    onSuccess: () => {
      toast.success("Loan pack revoked");
      utils.broker.get.invalidate({ id: brokerId });
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke loan pack");
    },
  });

  const handleCopyLink = async (packId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPackId(packId);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopiedPackId(null), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleDelete = () => {
    deleteMutation.mutate({ id: brokerId });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !broker) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/reports/brokers")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Broker Portal
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Broker not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activePacks = broker.packs.filter((p) => !p.isExpired);
  const expiredPacks = broker.packs.filter((p) => p.isExpired);

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/reports/brokers")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Broker Portal
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{broker.name}</CardTitle>
              {broker.company && (
                <CardDescription className="text-base mt-1">
                  <Building2 className="w-4 h-4 inline mr-1" />
                  {broker.company}
                </CardDescription>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {broker.email && (
              <a
                href={`mailto:${broker.email}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Mail className="w-4 h-4" />
                {broker.email}
              </a>
            )}
            {broker.phone && (
              <a
                href={`tel:${broker.phone}`}
                className="flex items-center gap-1 hover:text-foreground"
              >
                <Phone className="w-4 h-4" />
                {broker.phone}
              </a>
            )}
          </div>

          {broker.notes && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm whitespace-pre-wrap">{broker.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Loan Packs</CardTitle>
              <CardDescription>
                {broker.packs.length} {broker.packs.length === 1 ? "pack" : "packs"} sent to this
                broker
              </CardDescription>
            </div>
            <Button onClick={() => setShowPackModal(true)}>
              <Send className="w-4 h-4 mr-2" />
              Send Pack
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {broker.packs.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No loan packs sent to this broker yet</p>
              <Button variant="outline" onClick={() => setShowPackModal(true)}>
                <Send className="w-4 h-4 mr-2" />
                Send First Pack
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {activePacks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Active</h4>
                  {activePacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(new Date(pack.createdAt), "MMM d, yyyy")}
                          </span>
                          <Badge variant="default">Active</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")} &bull;{" "}
                          {pack.accessCount} {pack.accessCount === 1 ? "view" : "views"}
                          {pack.accessedAt && (
                            <>
                              {" "}
                              &bull; Last viewed{" "}
                              {formatDistanceToNow(new Date(pack.accessedAt), { addSuffix: true })}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyLink(pack.id, pack.url)}
                        >
                          {copiedPackId === pack.id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={pack.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeMutation.mutate({ id: pack.id })}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {expiredPacks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Expired</h4>
                  {expiredPacks.map((pack) => (
                    <div
                      key={pack.id}
                      className="flex items-center justify-between p-4 border rounded-lg opacity-60"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(new Date(pack.createdAt), "MMM d, yyyy")}
                          </span>
                          <Badge variant="secondary">Expired</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {pack.accessCount} {pack.accessCount === 1 ? "view" : "views"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeMutation.mutate({ id: pack.id })}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <BrokerModal open={showEditModal} onOpenChange={setShowEditModal} broker={broker} />

      <GenerateLoanPackModal
        open={showPackModal}
        onOpenChange={setShowPackModal}
        brokerId={brokerId}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Broker</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {broker.name} from your contacts. Any loan packs previously sent to
              them will remain accessible but will no longer be associated with this broker.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
