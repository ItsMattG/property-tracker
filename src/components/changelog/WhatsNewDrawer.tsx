"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc/client";
import { ChangelogEntry } from "./ChangelogEntry";
import Link from "next/link";

interface WhatsNewDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function WhatsNewDrawer({ open, onClose }: WhatsNewDrawerProps) {
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.changelog.list.useQuery(
    { limit: 10 },
    { enabled: open }
  );

  const markAsViewed = trpc.changelog.markAsViewed.useMutation({
    onSuccess: () => {
      utils.changelog.getUnreadCount.invalidate();
    },
  });

  useEffect(() => {
    if (open) {
      markAsViewed.mutate();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-lg z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">What&apos;s New</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : data?.entries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No updates yet. Check back soon!
            </p>
          ) : (
            <div className="space-y-4">
              {data?.entries.map((entry) => (
                <div key={entry.id} onClick={onClose}>
                  <ChangelogEntry entry={entry} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full" asChild onClick={onClose}>
            <Link href="/changelog">View full changelog</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
