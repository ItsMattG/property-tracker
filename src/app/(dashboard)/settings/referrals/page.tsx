"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Users, Award, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ReferralsPage() {
  const [copied, setCopied] = useState(false);

  const { data: codeData } = trpc.referral.getMyCode.useQuery();
  const { data: stats } = trpc.referral.getStats.useQuery();
  const { data: referralList } = trpc.referral.listReferrals.useQuery();

  const copyLink = () => {
    if (codeData?.shareUrl) {
      navigator.clipboard.writeText(codeData.shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Referrals</h2>
        <p className="text-muted-foreground">
          Invite friends and earn free months of PropertyTracker Pro
        </p>
      </div>

      {/* Share link */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Share this link with friends. When they sign up and add their first
            property, you both get 1 month of Pro free.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={codeData?.shareUrl ?? "Loading..."}
              className="font-mono text-sm"
            />
            <Button onClick={copyLink} variant="outline">
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Code: <span className="font-mono">{codeData?.code}</span>
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats?.invited ?? 0}</p>
            <p className="text-sm text-muted-foreground">Invited</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Award className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-3xl font-bold">{stats?.qualified ?? 0}</p>
            <p className="text-sm text-muted-foreground">Qualified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <Gift className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-3xl font-bold">{stats?.totalCredits ?? 0}</p>
            <p className="text-sm text-muted-foreground">Months Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Referral list */}
      {referralList && referralList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {referralList.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between border rounded-lg px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {ref.refereeName || ref.refereeEmail || "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Joined {format(new Date(ref.createdAt), "MMM d, yyyy")}
                      {ref.qualifiedAt &&
                        ` · Qualified ${format(new Date(ref.qualifiedAt), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <Badge
                    variant={
                      ref.status === "qualified" || ref.status === "rewarded"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {ref.status}
                  </Badge>
                </div>
              ))}
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
            <li>They sign up for PropertyTracker</li>
            <li>They add their first investment property</li>
            <li>You both get 1 month of Pro free</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
