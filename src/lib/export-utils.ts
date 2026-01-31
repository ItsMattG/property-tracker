interface TaxReportData {
  financialYear: string;
  properties: Array<{
    property: {
      address: string;
      suburb: string;
      state: string;
      entityName: string;
    };
    metrics: {
      totalIncome: number;
      totalExpenses: number;
      netIncome: number;
      totalDeductible: number;
    };
    atoBreakdown: Array<{
      label: string;
      amount: number;
      atoReference?: string;
      isDeductible: boolean;
    }>;
  }>;
  totals: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    totalDeductible: number;
  };
}

interface Transaction {
  date: string;
  description: string;
  amount: string;
  category: string;
  property?: { address: string } | null;
  isDeductible: boolean;
  isVerified: boolean;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generateTaxReportPDF(data: TaxReportData): Promise<Blob> {
  const response = await fetch("/api/export/tax-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to generate PDF");
  }

  return response.blob();
}

export async function generateTransactionsExcel(
  transactions: Transaction[],
  financialYear: string
): Promise<Blob> {
  const response = await fetch("/api/export/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions, financialYear }),
  });

  if (!response.ok) {
    throw new Error("Failed to generate Excel");
  }

  return response.blob();
}
