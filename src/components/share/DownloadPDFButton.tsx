"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadBlob } from "@/lib/export-utils";
import type { PortfolioSnapshot } from "@/server/services/share";

interface DownloadPDFButtonProps {
  data: PortfolioSnapshot;
  privacyMode: string;
  title: string;
}

export function DownloadPDFButton({ data, privacyMode, title }: DownloadPDFButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      // Lazy load jsPDF (~500KB) only when user clicks download
      const { generateSharePDF } = await import("@/lib/share-pdf");
      const blob = generateSharePDF(data, privacyMode, title);
      const filename = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
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
      {isLoading ? "Generating..." : "Download PDF"}
    </Button>
  );
}
