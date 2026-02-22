"use client";

import { useState } from "react";
import { Gift, Users, Award, Copy, Check, Clock, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ReferralDetail {
  id: string;
  displayName: string;
  status: "pending" | "qualified" | "rewarded" | "expired";
  createdAt: Date;
  qualifiedAt: Date | null;
}

const STATUS_BADGE_MAP: Record<
  ReferralDetail["status"],
  { variant: "default" | "secondary" | "warning" | "destructive"; label: string }
> = {
  pending: { variant: "warning", label: "Pending" },
  qualified: { variant: "default", label: "Qualified" },
  rewarded: { variant: "default", label: "Rewarded" },
  expired: { variant: "secondary", label: "Expired" },
};

export function ReferralDashboard() {
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = trpc.referral.getReferralDetails.useQuery();

  const handleCopyLink = () => {
    if (data?.shareUrl) {
      navigator.clipboard.writeText(data.shareUrl);
      setCopied(true);
      toast.success("Referral link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!data?.shareUrl) return;

    const shareData = {
      title: "Join BrickTrack",
      text: "Track your property investments with BrickTrack. Sign up with my link and we both get 1 month of Pro free!",
      url: data.shareUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled sharing
      }
    } else {
      handleCopyLink();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Give a month, get a month banner */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                {data.bannerCopy.headline}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {data.bannerCopy.description}
              </p>
            </div>
            <Button onClick={handleShare} className="shrink-0">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shareable URL */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Referral Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              readOnly
              value={data.shareUrl}
              className="font-mono text-sm"
            />
            <Button onClick={handleCopyLink} variant="outline" size="icon">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Code: <span className="font-mono">{data.code}</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{data.stats.invited}</p>
            <p className="text-sm text-muted-foreground">Invited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{data.stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{data.stats.qualified}</p>
            <p className="text-sm text-muted-foreground">Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{data.stats.totalCreditsEarned}</p>
            <p className="text-sm text-muted-foreground">Months Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral list */}
      {data.referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.referrals.map((ref) => {
                const badgeConfig = STATUS_BADGE_MAP[ref.status];
                return (
                  <div
                    key={ref.id}
                    className="flex items-center justify-between border rounded-lg px-4 py-3"
                  >
                    <div>
                      <p className="font-medium">{ref.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {format(new Date(ref.createdAt), "MMM d, yyyy")}
                        {ref.qualifiedAt &&
                          ` \u00B7 Qualified ${format(new Date(ref.qualifiedAt), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <Badge variant={badgeConfig.variant}>
                      {badgeConfig.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Share your referral link with a friend</li>
            <li>They sign up for BrickTrack</li>
            <li>They add their first investment property</li>
            <li>You both get 1 month of Pro free</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
