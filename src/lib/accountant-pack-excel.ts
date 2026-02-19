import * as ExcelJS from "exceljs";

import type { AccountantPackConfig } from "./accountant-pack-pdf";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8E8E8" },
};

const BOLD_FONT: Partial<ExcelJS.Font> = { bold: true };

const CURRENCY_FMT = '$#,##0.00';
const PERCENT_FMT = "0.0%";

/** Style the header row: bold, grey background, frozen. */
function styleHeaderRow(sheet: ExcelJS.Worksheet): void {
  const headerRow = sheet.getRow(1);
  headerRow.font = BOLD_FONT;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
  });
  sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 0 }];
}

/** Make an entire row bold. */
function boldRow(row: ExcelJS.Row): void {
  row.font = BOLD_FONT;
}

// ---------------------------------------------------------------------------
// Sheet builders
// ---------------------------------------------------------------------------

function addIncomeExpensesSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.taxReport;
  if (!data) return;

  const sheet = workbook.addWorksheet("Income & Expenses");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "ATO Ref", key: "atoRef", width: 12 },
    { header: "Category", key: "category", width: 25 },
    { header: "Type", key: "type", width: 12 },
    { header: "Amount", key: "amount", width: 16 },
  ];
  styleHeaderRow(sheet);

  for (const prop of data.properties) {
    const address = `${prop.property.address}, ${prop.property.suburb} ${prop.property.state}`;

    // Income items
    const incomeItems = prop.atoBreakdown.filter(
      (item) => !item.isDeductible && item.amount > 0,
    );
    for (const item of incomeItems) {
      const row = sheet.addRow({
        property: address,
        atoRef: item.atoReference ?? "",
        category: item.label,
        type: "Income",
        amount: item.amount,
      });
      row.getCell("amount").numFmt = CURRENCY_FMT;
    }

    // Deduction items sorted by D-number
    const deductionItems = prop.atoBreakdown
      .filter((item) => item.isDeductible && item.amount !== 0)
      .sort((a, b) => {
        const aNum = parseInt(a.atoReference?.replace("D", "") ?? "99");
        const bNum = parseInt(b.atoReference?.replace("D", "") ?? "99");
        return aNum - bNum;
      });
    for (const item of deductionItems) {
      const row = sheet.addRow({
        property: address,
        atoRef: item.atoReference ?? "",
        category: item.label,
        type: "Deduction",
        amount: Math.abs(item.amount),
      });
      row.getCell("amount").numFmt = CURRENCY_FMT;
    }

    // Subtotals row per property
    const subtotalRow = sheet.addRow({
      property: `${address} — Subtotal`,
      atoRef: "",
      category: "",
      type: "",
      amount: prop.metrics.netIncome,
    });
    subtotalRow.getCell("amount").numFmt = CURRENCY_FMT;
    boldRow(subtotalRow);

    // Blank separator
    sheet.addRow({});
  }

  // Grand totals
  const grandTotalRow = sheet.addRow({
    property: "GRAND TOTAL",
    atoRef: "",
    category: "",
    type: "",
    amount: data.totals.netIncome,
  });
  grandTotalRow.getCell("amount").numFmt = CURRENCY_FMT;
  boldRow(grandTotalRow);
}

function addDepreciationSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.myTaxReport;
  if (!data) return;

  const sheet = workbook.addWorksheet("Depreciation");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Division", key: "division", width: 30 },
    { header: "Amount", key: "amount", width: 16 },
  ];
  styleHeaderRow(sheet);

  for (const prop of data.properties) {
    if (
      prop.depreciation.capitalWorks === 0 &&
      prop.depreciation.plantEquipment === 0
    )
      continue;

    const address = `${prop.address}, ${prop.suburb} ${prop.state}`;

    if (prop.depreciation.capitalWorks > 0) {
      const row = sheet.addRow({
        property: address,
        division: "Capital Works (Div 43)",
        amount: prop.depreciation.capitalWorks,
      });
      row.getCell("amount").numFmt = CURRENCY_FMT;
    }

    if (prop.depreciation.plantEquipment > 0) {
      const row = sheet.addRow({
        property: address,
        division: "Plant & Equipment (Div 40)",
        amount: prop.depreciation.plantEquipment,
      });
      row.getCell("amount").numFmt = CURRENCY_FMT;
    }
  }
}

function addCapitalGainsSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.cgtData;
  if (!data) return;

  const sheet = workbook.addWorksheet("Capital Gains");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Purchased", key: "purchased", width: 14 },
    { header: "Sold", key: "sold", width: 14 },
    { header: "Cost Base", key: "costBase", width: 16 },
    { header: "Sale Price", key: "salePrice", width: 16 },
    { header: "Capital Gain", key: "capitalGain", width: 16 },
    { header: "Discounted Gain", key: "discountedGain", width: 16 },
    { header: "Held >12mo", key: "heldOver12", width: 12 },
  ];
  styleHeaderRow(sheet);

  if (data.length === 0) {
    sheet.addRow({
      property: "No properties sold in this financial year",
      purchased: "",
      sold: "",
      costBase: "",
      salePrice: "",
      capitalGain: "",
      discountedGain: "",
      heldOver12: "",
    });
    return;
  }

  for (const prop of data) {
    const row = sheet.addRow({
      property: prop.propertyAddress,
      purchased: prop.purchaseDate,
      sold: prop.saleDate,
      costBase: prop.costBase,
      salePrice: prop.salePrice,
      capitalGain: prop.capitalGain,
      discountedGain: prop.discountedGain,
      heldOver12: prop.heldOverTwelveMonths ? "Yes" : "No",
    });
    row.getCell("costBase").numFmt = CURRENCY_FMT;
    row.getCell("salePrice").numFmt = CURRENCY_FMT;
    row.getCell("capitalGain").numFmt = CURRENCY_FMT;
    row.getCell("discountedGain").numFmt = CURRENCY_FMT;
  }
}

function addTaxPositionSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.taxPosition;
  if (!data) return;

  const sheet = workbook.addWorksheet("Tax Position");
  sheet.columns = [
    { header: "Item", key: "item", width: 30 },
    { header: "Amount", key: "amount", width: 20 },
  ];
  styleHeaderRow(sheet);

  const addCurrencyRow = (item: string, amount: number, bold = false) => {
    const row = sheet.addRow({ item, amount });
    row.getCell("amount").numFmt = CURRENCY_FMT;
    if (bold) boldRow(row);
  };

  addCurrencyRow("Taxable Income", data.taxableIncome);
  addCurrencyRow("Base Tax", data.baseTax);
  addCurrencyRow("Medicare Levy", data.medicareLevy);
  if (data.medicareLevySurcharge > 0) {
    addCurrencyRow("Medicare Levy Surcharge", data.medicareLevySurcharge);
  }
  if (data.hecsRepayment > 0) {
    addCurrencyRow("HECS/HELP Repayment", data.hecsRepayment);
  }
  addCurrencyRow("Total Tax Liability", data.totalTaxLiability, true);
  addCurrencyRow("PAYG Withheld", data.paygWithheld);

  const resultLabel = data.isRefund ? "Estimated Refund" : "Estimated Owing";
  addCurrencyRow(resultLabel, Math.abs(data.refundOrOwing), true);

  // Marginal rate as percentage
  const rateRow = sheet.addRow({
    item: "Marginal Rate",
    amount: data.marginalRate,
  });
  rateRow.getCell("amount").numFmt = PERCENT_FMT;

  addCurrencyRow("Property Tax Savings", data.propertySavings);
}

function addPortfolioOverviewSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.portfolioSnapshot;
  if (!data) return;

  const sheet = workbook.addWorksheet("Portfolio Overview");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Purchase Price", key: "purchasePrice", width: 18 },
    { header: "Current Value", key: "currentValue", width: 18 },
    { header: "Equity", key: "equity", width: 18 },
    { header: "LVR", key: "lvr", width: 10 },
  ];
  styleHeaderRow(sheet);

  for (const prop of data.properties) {
    const address = `${prop.address}, ${prop.suburb} ${prop.state}`;
    const row = sheet.addRow({
      property: address,
      purchasePrice: prop.purchasePrice,
      currentValue: prop.currentValue,
      equity: prop.equity,
      lvr: prop.lvr,
    });
    row.getCell("purchasePrice").numFmt = CURRENCY_FMT;
    row.getCell("currentValue").numFmt = CURRENCY_FMT;
    row.getCell("equity").numFmt = CURRENCY_FMT;
    row.getCell("lvr").numFmt = PERCENT_FMT;
  }

  // Totals row
  const totalsRow = sheet.addRow({
    property: "TOTAL",
    purchasePrice: "",
    currentValue: data.totals.totalValue,
    equity: data.totals.totalEquity,
    lvr: data.totals.avgLvr,
  });
  totalsRow.getCell("currentValue").numFmt = CURRENCY_FMT;
  totalsRow.getCell("equity").numFmt = CURRENCY_FMT;
  totalsRow.getCell("lvr").numFmt = PERCENT_FMT;
  boldRow(totalsRow);
}

function addLoanDetailsSheet(
  workbook: ExcelJS.Workbook,
  config: AccountantPackConfig,
): void {
  const data = config.data.loanPackSnapshot;
  if (!data) return;

  const sheet = workbook.addWorksheet("Loan Details");
  sheet.columns = [
    { header: "Property", key: "property", width: 35 },
    { header: "Lender", key: "lender", width: 18 },
    { header: "Type", key: "type", width: 12 },
    { header: "Balance", key: "balance", width: 18 },
    { header: "Rate", key: "rate", width: 10 },
    { header: "Monthly Repayment", key: "monthlyRepayment", width: 20 },
  ];
  styleHeaderRow(sheet);

  for (const prop of data.properties) {
    for (const loan of prop.loans) {
      const row = sheet.addRow({
        property: prop.address,
        lender: loan.lender,
        type: loan.type,
        balance: loan.balance,
        rate: loan.rate / 100,
        monthlyRepayment: loan.monthlyRepayment,
      });
      row.getCell("balance").numFmt = CURRENCY_FMT;
      row.getCell("rate").numFmt = PERCENT_FMT;
      row.getCell("monthlyRepayment").numFmt = CURRENCY_FMT;
    }
  }

  // Totals row
  const totalsRow = sheet.addRow({
    property: "TOTAL",
    lender: "",
    type: "",
    balance: data.totals.totalDebt,
    rate: data.totals.avgRate / 100,
    monthlyRepayment: data.totals.monthlyRepayments,
  });
  totalsRow.getCell("balance").numFmt = CURRENCY_FMT;
  totalsRow.getCell("rate").numFmt = PERCENT_FMT;
  totalsRow.getCell("monthlyRepayment").numFmt = CURRENCY_FMT;
  boldRow(totalsRow);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate accountant pack Excel workbook. Returns ArrayBuffer suitable for:
 * - Client-side: `new Blob([result], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })`
 * - Server-side: `Buffer.from(result)` for Resend attachment
 */
export async function generateAccountantPackExcel(
  config: AccountantPackConfig,
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BrickTrack";
  workbook.created = new Date();

  if (config.sections.incomeExpenses) addIncomeExpensesSheet(workbook, config);
  if (config.sections.depreciation) addDepreciationSheet(workbook, config);
  if (config.sections.capitalGains) addCapitalGainsSheet(workbook, config);
  if (config.sections.taxPosition) addTaxPositionSheet(workbook, config);
  if (config.sections.portfolioOverview)
    addPortfolioOverviewSheet(workbook, config);
  if (config.sections.loanDetails) addLoanDetailsSheet(workbook, config);

  const buffer = await workbook.xlsx.writeBuffer();
  // writeBuffer() returns a Node Buffer at runtime despite type declarations.
  // Convert to a real ArrayBuffer so the return type matches the PDF module's contract.
  const nodeBuffer = buffer as unknown as Uint8Array;
  return nodeBuffer.buffer.slice(
    nodeBuffer.byteOffset,
    nodeBuffer.byteOffset + nodeBuffer.byteLength,
  ) as ArrayBuffer;
}
