"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Copy, Trash2, Eye, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { CreateShareModal } from "@/components/share/CreateShareModal";

// Moved outside component to avoid impure function calls during render
function isExpired(expiresAt: Date): boolean {
  return new Date(expiresAt) < new Date();
}

function isExpiringSoon(expiresAt: Date): boolean {
  const daysUntil = (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntil <= 3 && daysUntil > 0;
}

export default function ManageSharesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: shares, isLoading } = trpc.share.list.useQuery();

  const revokeMutation = trpc.share.revoke.useMutation({
    onSuccess: () => {
      toast.success("Share revoked");
      utils.share.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Portfolio Shares</h2>
          <p className="text-muted-foreground">
            Create shareable reports of your portfolio
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Share
        </Button>
      </div>

      {!shares || shares.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Share2 className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No shares yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a shareable link to your portfolio for brokers, partners, or advisors.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Share
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Active Shares</CardTitle>
            <CardDescription>
              Manage your shareable portfolio links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Privacy</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell className="font-medium">{share.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {share.privacyMode}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {share.isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : isExpiringSoon(new Date(share.expiresAt)) ? (
                        <Badge variant="secondary">
                          {format(new Date(share.expiresAt), "MMM d")}
                        </Badge>
                      ) : (
                        format(new Date(share.expiresAt), "MMM d, yyyy")
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="w-3 h-3 text-muted-foreground" />
                        {share.viewCount}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Share actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => copyLink(share.url)}
                            disabled={share.isExpired}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => revokeMutation.mutate({ id: share.id })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <CreateShareModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
