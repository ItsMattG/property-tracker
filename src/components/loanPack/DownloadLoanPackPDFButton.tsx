"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateLoanPackPDF } from "@/lib/loan-pack-pdf";
import { downloadBlob } from "@/lib/export-utils";
import type { LoanPackSnapshot } from "@/server/services/loanPack";

interface DownloadLoanPackPDFButtonProps {
  data: LoanPackSnapshot;
}

export function DownloadLoanPackPDFButton({ data }: DownloadLoanPackPDFButtonProps) {
  const handleDownload = () => {
    const blob = generateLoanPackPDF(data);
    const filename = `loan-pack-${new Date(data.generatedAt).toISOString().split("T")[0]}.pdf`;
    downloadBlob(blob, filename);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download PDF
    </Button>
  );
}
