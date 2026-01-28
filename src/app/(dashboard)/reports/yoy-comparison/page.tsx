import { Suspense } from "react";
import { YoYComparisonContent } from "@/components/reports/YoYComparisonContent";

export const dynamic = "force-dynamic";

function YoYComparisonLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Year-over-Year Comparison</h2>
        <p className="text-muted-foreground">
          Compare expense categories across financial years
        </p>
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function YoYComparisonPage() {
  return (
    <Suspense fallback={<YoYComparisonLoading />}>
      <YoYComparisonContent />
    </Suspense>
  );
}
