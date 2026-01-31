import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import * as XLSX from "xlsx";

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
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { transactions, financialYear }: ExportRequest = await req.json();

    const data = transactions.map((t) => ({
      Date: t.date,
      Property: t.property?.address || "Unassigned",
      Description: t.description,
      Amount: Number(t.amount),
      Category: t.category,
      Deductible: t.isDeductible ? "Yes" : "No",
      Verified: t.isVerified ? "Yes" : "No",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, financialYear);

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    return new NextResponse(excelBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="transactions-${financialYear}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate transactions Excel:", error);
    return NextResponse.json(
      { error: "Failed to generate Excel" },
      { status: 500 }
    );
  }
}
