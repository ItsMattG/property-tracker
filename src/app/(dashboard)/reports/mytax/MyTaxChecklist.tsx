"use client";

import type { MyTaxReport } from "@/server/services/mytax";

interface MyTaxChecklistProps {
  report: MyTaxReport;
}

export function MyTaxChecklist({ report }: MyTaxChecklistProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        {report.properties.length} properties · {report.financialYear}
      </p>
    </div>
  );
}
