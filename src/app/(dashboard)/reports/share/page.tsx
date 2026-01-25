"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreHorizontal, Copy, Trash2, Eye, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { CreateShareModal } from "@/components/share/CreateShareModal";

function isExpired(expiresAt: Date | string): boolean {
  return new Date() > new Date(expiresAt);
}

function isExpiringSoon(expiresAt: Date | string): boolean {
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const expiry = new Date(expiresAt);
  return !isExpired(expiresAt) && expiry < sevenDaysFromNow;
}

function getPrivacyBadgeVariant(privacyMode: string): "default" | "secondary" | "outline" {
  switch (privacyMode) {
    case "full":
      return "default";
    case "summary":
      return "secondary";
    case "redacted":
      return "outline";
    default:
      return "secondary";
  }
}

function getPrivacyLabel(privacyMode: string): string {
  switch (privacyMode) {
    case "full":
      return "Full Details";
    case "summary":
      return "Summary Only";
    case "redacted":
      return "Redacted";
    default:
      return privacyMode;
  }
}

export default function ManageSharesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const utils = trpc.useUtils();

  const { data: shares, isLoading } = trpc.share.list.useQuery();

  const revokeMutation = trpc.share.revoke.useMutation({
    onSuccess: () => {
      toast.success("Share link revoked");
      utils.share.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to revoke share");
    },
  });

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleRevoke = (id: string) => {
    revokeMutation.mutate({ id });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const activeShares = shares?.filter((s) => !s.isExpired) || [];
  const expiredShares = shares?.filter((s) => s.isExpired) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Share Portfolio</h2>
          <p className="text-muted-foreground">
            Create shareable links to your portfolio snapshot
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Create Share Link
        </Button>
      </div>

      {shares?.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Share2 className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No shares yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Create a shareable link to give others a read-only view of your portfolio.
              You control what information they can see.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Share
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {activeShares.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active Shares</CardTitle>
                <CardDescription>
                  {activeShares.length} active share {activeShares.length === 1 ? "link" : "links"}
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
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeShares.map((share) => (
                      <TableRow key={share.id}>
                        <TableCell className="font-medium">{share.title}</TableCell>
                        <TableCell>
                          <Badge variant={getPrivacyBadgeVariant(share.privacyMode)}>
                            {getPrivacyLabel(share.privacyMode)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          {isExpiringSoon(share.expiresAt) ? (
                            <span className="text-yellow-600 dark:text-yellow-400">
                              {format(new Date(share.expiresAt), "MMM d, yyyy")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              {format(new Date(share.expiresAt), "MMM d, yyyy")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Eye className="w-4 h-4" />
                            <span>{share.viewCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => copyLink(share.url)}>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy Link
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleRevoke(share.id)}
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

          {expiredShares.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-muted-foreground">Expired Shares</CardTitle>
                <CardDescription>
                  {expiredShares.length} expired share {expiredShares.length === 1 ? "link" : "links"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Privacy</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Expired</TableHead>
                      <TableHead>Views</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiredShares.map((share) => (
                      <TableRow key={share.id} className="opacity-60">
                        <TableCell className="font-medium">{share.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getPrivacyLabel(share.privacyMode)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(share.expiresAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Eye className="w-4 h-4" />
                            <span>{share.viewCount}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => handleRevoke(share.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
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
        </>
      )}

      <CreateShareModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  );
}
