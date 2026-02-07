"use client";

import { ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";

type FeatureCardProps = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  voteCount: number;
  userName: string | null;
  createdAt: string;
  hasVoted: boolean;
};

const statusColors: Record<string, string> = {
  open: "bg-gray-100 text-gray-800",
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  shipped: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
  rejected: "Rejected",
};

export function FeatureCard({
  id,
  title,
  description,
  category,
  status,
  voteCount,
  userName,
  createdAt,
  hasVoted,
}: FeatureCardProps) {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;
  const utils = trpc.useUtils();

  const voteMutation = trpc.feedback.voteFeature.useMutation({
    onSuccess: () => {
      utils.feedback.listFeatures.invalidate();
      utils.feedback.getUserVotes.invalidate();
    },
  });

  const handleVote = () => {
    if (!isSignedIn) return;
    voteMutation.mutate({ featureId: id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="flex flex-col items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              hasVoted && "text-primary"
            )}
            onClick={handleVote}
            disabled={!isSignedIn || voteMutation.isPending}
          >
            <ChevronUp className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium">{voteCount}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge className={statusColors[status]}>{statusLabels[status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{category}</p>
        </div>
      </CardHeader>
      <CardContent className="pl-16">
        <p className="text-sm text-muted-foreground line-clamp-3">
          {description}
        </p>
        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>by {userName ?? "Anonymous"}</span>
          <span>{new Date(createdAt).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}
