import { Suspense } from "react";
import { AuditChecksContent } from "@/components/reports/AuditChecksContent";

export const dynamic = "force-dynamic";

function AuditChecksLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit Checks</h2>
        <p className="text-muted-foreground">
          Automated checks for tax readiness and data quality
        </p>
      </div>
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
      <div className="h-48 bg-muted animate-pulse rounded-lg" />
      <div className="h-32 bg-muted animate-pulse rounded-lg" />
    </div>
  );
}

export default function AuditChecksPage() {
  return (
    <Suspense fallback={<AuditChecksLoading />}>
      <AuditChecksContent />
    </Suspense>
  );
}
