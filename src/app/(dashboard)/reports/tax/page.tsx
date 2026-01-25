import { Suspense } from "react";
import { TaxReportContent } from "./TaxReportContent";

export const dynamic = "force-dynamic";

function TaxReportLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Tax Report</h2>
        <p className="text-muted-foreground">
          Generate ATO-compliant rental property tax reports
        </p>
      </div>
      <div className="h-64 bg-muted animate-pulse rounded-lg" />
      <div className="h-48 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function TaxReportPage() {
  return (
    <Suspense fallback={<TaxReportLoading />}>
      <TaxReportContent />
    </Suspense>
  );
}
