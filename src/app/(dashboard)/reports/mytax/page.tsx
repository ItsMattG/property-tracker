import { Suspense } from "react";
import { MyTaxContent } from "./MyTaxContent";

export const dynamic = "force-dynamic";

function MyTaxLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">MyTax Export</h2>
        <p className="text-muted-foreground">Loading report data...</p>
      </div>
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded w-48" />
        <div className="h-64 bg-muted rounded" />
      </div>
    </div>
  );
}

export default function MyTaxPage() {
  return (
    <Suspense fallback={<MyTaxLoading />}>
      <MyTaxContent />
    </Suspense>
  );
}
