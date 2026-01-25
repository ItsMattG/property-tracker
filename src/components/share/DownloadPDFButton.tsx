"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { generateSharePDF } from "@/lib/share-pdf";
import { downloadBlob } from "@/lib/export-utils";
import type { PortfolioSnapshot } from "@/server/services/share";

interface DownloadPDFButtonProps {
  data: PortfolioSnapshot;
  privacyMode: string;
  title: string;
}

export function DownloadPDFButton({ data, privacyMode, title }: DownloadPDFButtonProps) {
  const handleDownload = () => {
    const blob = generateSharePDF(data, privacyMode, title);
    const filename = `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    downloadBlob(blob, filename);
  };

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <Download className="w-4 h-4 mr-2" />
      Download PDF
    </Button>
  );
}
