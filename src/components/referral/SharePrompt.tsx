"use client";

import { useState } from "react";
import { Share2, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

interface SharePromptProps {
  milestoneLabel: string;
  onDismiss: () => void;
}

export function SharePrompt({ milestoneLabel, onDismiss }: SharePromptProps) {
  const [copied, setCopied] = useState(false);

  const { data: codeData } = trpc.referral.getMyCode.useQuery();

  const shareText = `Just hit "${milestoneLabel}" on BrickTrack! Track your property investments at`;

  const handleCopy = () => {
    if (!codeData?.shareUrl) return;

    const fullText = `${shareText} ${codeData.shareUrl}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Share text copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (!codeData?.shareUrl) return;

    const shareData = {
      title: "BrickTrack Achievement",
      text: shareText,
      url: codeData.shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onDismiss();
      } catch {
        // User cancelled sharing
      }
    } else {
      handleCopy();
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Share2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Share your achievement?</p>
              <p className="text-xs text-muted-foreground mt-1">
                {shareText}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-8 w-8"
            onClick={onDismiss}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-3 ml-13">
          <Button size="sm" onClick={handleNativeShare}>
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Share
          </Button>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="w-3.5 h-3.5 mr-1.5" />
            ) : (
              <Copy className="w-3.5 h-3.5 mr-1.5" />
            )}
            Copy Link
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
