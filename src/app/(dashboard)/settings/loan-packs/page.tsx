"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Copy, Check, Trash2, FileText, ExternalLink } from "lucide-react";
import { useState } from "react";
import { GenerateLoanPackButton } from "@/components/loanPack/GenerateLoanPackButton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function LoanPacksPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: packs, isLoading } = trpc.loanPack.list.useQuery();
  const utils = trpc.useUtils();

  const revokeMutation = trpc.loanPack.revoke.useMutation({
    onSuccess: () => {
      utils.loanPack.list.invalidate();
      setRevokeId(null);
    },
  });

  const handleCopy = async (id: string, url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRevoke = () => {
    if (revokeId) revokeMutation.mutate({ id: revokeId });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Loan Application Packs</h1>
          <p className="text-muted-foreground">Manage your shareable portfolio reports for mortgage brokers</p>
        </div>
        <GenerateLoanPackButton />
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      ) : !packs || packs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No loan packs yet</h3>
            <p className="text-muted-foreground mb-4">Generate a loan pack to share your portfolio data with your mortgage broker.</p>
            <GenerateLoanPackButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {packs.map((pack) => (
            <Card key={pack.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">Loan Pack - {format(new Date(pack.createdAt), "MMM d, yyyy")}</CardTitle>
                    <CardDescription className="mt-1">
                      {pack.isExpired ? <Badge variant="destructive">Expired</Badge> : <Badge variant="secondary">Expires {format(new Date(pack.expiresAt), "MMM d, yyyy")}</Badge>}
                      <span className="ml-2">{pack.accessCount} views</span>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {!pack.isExpired && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleCopy(pack.id, pack.url)}>
                          {copiedId === pack.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={pack.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a>
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setRevokeId(pack.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!pack.isExpired && (
                <CardContent className="pt-0">
                  <div className="font-mono text-sm text-muted-foreground bg-muted p-2 rounded truncate">{pack.url}</div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Loan Pack</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this loan pack and make the link inaccessible. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revoke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
