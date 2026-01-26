// src/app/(dashboard)/reports/tax-position/page.tsx

import { Suspense } from "react";
import { TaxPositionContent } from "./TaxPositionContent";

export const dynamic = "force-dynamic";

function TaxPositionLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Position</h2>
        <p className="text-muted-foreground">
          Your estimated tax outcome for the financial year
        </p>
      </div>
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function TaxPositionPage() {
  return (
    <Suspense fallback={<TaxPositionLoading />}>
      <TaxPositionContent />
    </Suspense>
  );
}
