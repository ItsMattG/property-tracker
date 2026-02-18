import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockContext,
  createMockUow,
  mockUser,
} from "../../../__tests__/test-utils";

// Mock external dependencies before imports
vi.mock("resend", () => {
  class MockResend {
    emails = {
      send: vi.fn().mockResolvedValue({ id: "email-123" }),
    };
  }
  return { Resend: MockResend };
});

vi.mock("@/lib/accountant-pack-pdf", () => ({
  generateAccountantPackPDF: vi.fn().mockReturnValue(new ArrayBuffer(100)),
}));

vi.mock("@/lib/email/templates/accountant-pack", () => ({
  accountantPackEmailTemplate: vi
    .fn()
    .mockReturnValue("<html>test email</html>"),
}));

vi.mock("../../../services/transaction/reports", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("../../../services/transaction/reports")
    >();
  return {
    ...original,
    getFinancialYearTransactions: vi.fn().mockResolvedValue([]),
    getPropertiesWithLoans: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("../../../services/transaction/mytax", () => ({
  buildMyTaxReport: vi.fn().mockResolvedValue({
    financialYear: "FY2024-25",
    properties: [],
    totalIncome: 0,
    totalDeductions: 0,
    netRentalResult: 0,
  }),
}));

describe("accountantPack router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("can import the router module", async () => {
    const mod = await import("../accountantPack");
    expect(mod.accountantPackRouter).toBeDefined();
  });

  it("generateAccountantPackPDF mock returns ArrayBuffer", async () => {
    const { generateAccountantPackPDF } = await import(
      "@/lib/accountant-pack-pdf"
    );
    expect(generateAccountantPackPDF).toBeDefined();
    const result = generateAccountantPackPDF({
      financialYear: 2025,
      userName: "Test User",
      sections: {
        incomeExpenses: true,
        depreciation: false,
        capitalGains: false,
        taxPosition: false,
        portfolioOverview: false,
        loanDetails: false,
      },
      data: {},
    });
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it("accountantPackEmailTemplate mock returns HTML string", async () => {
    const { accountantPackEmailTemplate } = await import(
      "@/lib/email/templates/accountant-pack"
    );
    expect(accountantPackEmailTemplate).toBeDefined();
    const result = accountantPackEmailTemplate({
      userName: "Test User",
      userEmail: "test@example.com",
      financialYear: 2025,
      sections: ["Income & Expenses"],
    });
    expect(result).toContain("<html>");
  });

  it("Resend mock can send emails", async () => {
    const { Resend } = await import("resend");
    const resend = new Resend("test-key");
    const result = await resend.emails.send({
      from: "test@example.com",
      to: "accountant@example.com",
      subject: "Test",
      html: "<p>Test</p>",
    });
    expect(result).toEqual({ id: "email-123" });
  });

  it("createMockUow provides team repository stubs", () => {
    const uow = createMockUow({
      team: {
        listMembers: vi.fn().mockResolvedValue([]),
        listPendingInvites: vi.fn().mockResolvedValue([]),
      },
    });
    expect(uow.team.listMembers).toBeDefined();
    expect(uow.team.listPendingInvites).toBeDefined();
  });

  it("router exposes generatePackData procedure", async () => {
    const { accountantPackRouter } = await import("../accountantPack");
    // Verify the procedure exists on the router definition
    expect(accountantPackRouter._def.procedures).toHaveProperty("generatePackData");
  });

  it("router exposes all expected procedures", async () => {
    const { accountantPackRouter } = await import("../accountantPack");
    const procedures = Object.keys(accountantPackRouter._def.procedures);
    expect(procedures).toContain("generatePackData");
    expect(procedures).toContain("generatePack");
    expect(procedures).toContain("sendToAccountant");
    expect(procedures).toContain("getSendHistory");
  });
});
