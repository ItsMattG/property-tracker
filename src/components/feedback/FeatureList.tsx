"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { FeatureCard } from "./FeatureCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { FeatureRequestModal } from "./FeatureRequestModal";

type StatusFilter = "all" | "open" | "planned" | "in_progress" | "shipped";
type SortBy = "votes" | "newest" | "oldest";

export function FeatureList() {
  const { data: session } = authClient.useSession();
  const isSignedIn = !!session?.user;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("votes");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: features, isLoading } = trpc.feedback.listFeatures.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    sortBy,
  });

  const { data: userVotes } = trpc.feedback.getUserVotes.useQuery(undefined, {
    enabled: isSignedIn,
  });

  const votedFeatureIds = new Set(userVotes ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="votes">Most Votes</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="oldest">Oldest</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isSignedIn && (
          <Button onClick={() => setModalOpen(true)}>Request Feature</Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : features?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No feature requests yet. Be the first to suggest one!
        </div>
      ) : (
        <div className="space-y-4">
          {features?.map((feature) => (
            <FeatureCard
              key={feature.id}
              {...feature}
              hasVoted={votedFeatureIds.has(feature.id)}
            />
          ))}
        </div>
      )}

      <FeatureRequestModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
