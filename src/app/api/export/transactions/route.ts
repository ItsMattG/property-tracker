import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import ExcelJS from "exceljs";
import { logger } from "@/lib/logger";

interface Transaction {
  date: string;
  description: string;
  amount: string;
  category: string;
  property?: { address: string } | null;
  isDeductible: boolean;
  isVerified: boolean;
}

interface ExportRequest {
  transactions: Transaction[];
  financialYear: string;
}

export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { transactions, financialYear }: ExportRequest = await req.json();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(financialYear);

    worksheet.columns = [
      { header: "Date", key: "date", width: 12 },
      { header: "Property", key: "property", width: 30 },
      { header: "Description", key: "description", width: 30 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Category", key: "category", width: 18 },
      { header: "Deductible", key: "deductible", width: 10 },
      { header: "Verified", key: "verified", width: 10 },
    ];

    for (const t of transactions) {
      worksheet.addRow({
        date: t.date,
        property: t.property?.address || "Unassigned",
        description: t.description,
        amount: Number(t.amount),
        category: t.category,
        deductible: t.isDeductible ? "Yes" : "No",
        verified: t.isVerified ? "Yes" : "No",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="transactions-${financialYear}.xlsx"`,
      },
    });
  } catch (error) {
    logger.error("Failed to generate transactions Excel", error instanceof Error ? error : new Error(String(error)), { domain: "export", format: "xlsx" });
    return NextResponse.json(
      { error: "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
