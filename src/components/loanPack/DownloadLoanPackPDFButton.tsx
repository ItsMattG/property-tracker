"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/export-utils";
import type { LoanPackSnapshot } from "@/server/services/lending/loan-pack";

interface DownloadLoanPackPDFButtonProps {
  data: LoanPackSnapshot;
}

export function DownloadLoanPackPDFButton({ data }: DownloadLoanPackPDFButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const { generateLoanPackPDF } = await import("@/lib/loan-pack-pdf");
      const blob = generateLoanPackPDF(data);
      const filename = `loan-pack-${new Date(data.generatedAt).toISOString().split("T")[0]}.pdf`;
      downloadBlob(blob, filename);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Download className="w-4 h-4 mr-2" />
      )}
      Download PDF
    </Button>
  );
}
