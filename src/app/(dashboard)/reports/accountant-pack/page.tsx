"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { generateAccountantPackPDF } from "@/lib/accountant-pack-pdf";
import { generateAccountantPackExcel } from "@/lib/accountant-pack-excel";
import { trpc } from "@/lib/trpc/client";
import { downloadBlob } from "@/lib/export-utils";
import { getErrorMessage } from "@/lib/errors";
import {
  Briefcase,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Mail,
  Send,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

const SECTION_CONFIG = [
  {
    key: "incomeExpenses" as const,
    label: "Income & Expenses",
    description: "Rental income and deductions by ATO code",
    defaultOn: true,
  },
  {
    key: "depreciation" as const,
    label: "Depreciation Schedule",
    description: "Capital works (Div 43) and plant & equipment (Div 40)",
    defaultOn: true,
  },
  {
    key: "capitalGains" as const,
    label: "Capital Gains Tax",
    description: "CGT calculations for sold properties",
    defaultOn: true,
  },
  {
    key: "taxPosition" as const,
    label: "Tax Position Summary",
    description: "Taxable income, refund/owing estimate",
    defaultOn: true,
  },
  {
    key: "portfolioOverview" as const,
    label: "Portfolio Overview",
    description: "Property values, equity, and LVR",
    defaultOn: false,
  },
  {
    key: "loanDetails" as const,
    label: "Loan Details",
    description: "Loan balances, rates, and repayments",
    defaultOn: false,
  },
];

type SectionKey = (typeof SECTION_CONFIG)[number]["key"];

export default function AccountantPackPage() {
  const currentYear =
    new Date().getMonth() >= 6
      ? new Date().getFullYear() + 1
      : new Date().getFullYear();

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>(
    () =>
      Object.fromEntries(
        SECTION_CONFIG.map((s) => [s.key, s.defaultOn])
      ) as Record<SectionKey, boolean>
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);

  const { data: availableYears } = trpc.reports.getAvailableYears.useQuery();
  const { data: members } = trpc.team.listMembers.useQuery(undefined, {
    retry: false,
  });
  const { data: invites } = trpc.team.listInvites.useQuery(undefined, {
    retry: false,
  });
  const { data: sendHistory } = trpc.accountantPack.getSendHistory.useQuery();
  const { data: subscription } = trpc.billing.getSubscription.useQuery();

  const utils = trpc.useUtils();

  const packDataQuery = trpc.accountantPack.generatePackData.useQuery(
    { financialYear: selectedYear, sections },
    { enabled: false }
  );

  const sendMutation = trpc.accountantPack.sendToAccountant.useMutation({
    onSuccess: (data) => {
      toast.success(`Sent to ${data.sentTo}`);
      setShowConfirmDialog(false);
      utils.accountantPack.getSendHistory.invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  // Find connected accountant from members or pending invites
  const accountant = members?.members.find((m) => m.role === "accountant");
  const pendingAccountantInvite = invites?.find(
    (inv) => inv.role === "accountant" && inv.status === "pending"
  );
  const accountantEmail =
    accountant?.user?.email || pendingAccountantInvite?.email;
  const accountantName = accountant?.user?.name;
  const hasAccountant = !!accountantEmail;
  const isPro = subscription?.plan !== "free";

  const anySectionEnabled = Object.values(sections).some(Boolean);

  const handleToggleSection = (key: SectionKey) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const result = await packDataQuery.refetch();
      if (!result.data) throw new Error("Failed to fetch data");
      const pdfBuffer = generateAccountantPackPDF(result.data);
      const blob = new Blob([pdfBuffer], { type: "application/pdf" });
      downloadBlob(blob, `accountant-pack-FY${selectedYear}.pdf`);
      toast.success("PDF downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadExcel = async () => {
    setIsGeneratingExcel(true);
    try {
      const result = await packDataQuery.refetch();
      if (!result.data) throw new Error("Failed to fetch data");
      const excelBuffer = await generateAccountantPackExcel(result.data);
      const blob = new Blob([excelBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `accountant-pack-FY${selectedYear}.xlsx`);
      toast.success("Excel downloaded");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleSend = () => {
    sendMutation.mutate({
      financialYear: selectedYear,
      sections,
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Accountant Pack</h2>
        <p className="text-muted-foreground">
          Generate and send a comprehensive report to your accountant
        </p>
      </div>

      {/* Connected Accountant */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connected Accountant</CardTitle>
        </CardHeader>
        <CardContent>
          {hasAccountant ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Briefcase className="w-5 h-5 text-primary" />
                </div>
                <div>
                  {accountantName && (
                    <p className="font-medium">{accountantName}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {accountantEmail}
                  </p>
                  {pendingAccountantInvite && !accountant && (
                    <p className="text-xs text-amber-600">Invite pending</p>
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/advisors">Manage</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                No accountant connected yet
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/settings/advisors">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Accountant
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pack Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Configure Pack</CardTitle>
          <CardDescription>
            Select the financial year and sections to include
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Year Selection */}
          <div className="space-y-2">
            <Label>Financial Year</Label>
            <Select
              value={String(selectedYear)}
              onValueChange={(v) => setSelectedYear(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears?.map((y) => (
                  <SelectItem key={y.year} value={String(y.year)}>
                    {y.label}
                  </SelectItem>
                )) || (
                  <SelectItem value={String(currentYear)}>
                    FY {currentYear - 1}-{String(currentYear).slice(-2)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Section Toggles */}
          <div className="space-y-4">
            <Label>Sections</Label>
            {SECTION_CONFIG.map((section) => (
              <div
                key={section.key}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium cursor-pointer">
                    {section.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <Switch
                  checked={sections[section.key]}
                  onCheckedChange={() => handleToggleSection(section.key)}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf || !anySectionEnabled}
            >
              {isGeneratingPdf ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadExcel}
              disabled={isGeneratingExcel || !anySectionEnabled}
            >
              {isGeneratingExcel ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Download Excel
            </Button>

            {isPro ? (
              <Button
                onClick={() => setShowConfirmDialog(true)}
                disabled={
                  !hasAccountant ||
                  !anySectionEnabled ||
                  sendMutation.isPending
                }
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Email to Accountant
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() =>
                  toast.info("Upgrade to Pro to email your accountant", {
                    action: {
                      label: "Upgrade",
                      onClick: () =>
                        window.location.assign("/settings/billing"),
                    },
                  })
                }
              >
                <Lock className="w-4 h-4 mr-2" />
                Email to Accountant
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Send History */}
      {sendHistory && sendHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Sent To</TableHead>
                  <TableHead>Sections</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sendHistory.map((send) => {
                  const sectionCount = Object.values(
                    send.sections as Record<string, boolean>
                  ).filter(Boolean).length;
                  return (
                    <TableRow key={send.id}>
                      <TableCell className="text-sm">
                        {formatDate(send.sentAt)}
                      </TableCell>
                      <TableCell className="text-sm">
                        FY{send.financialYear}
                      </TableCell>
                      <TableCell className="text-sm">
                        {send.accountantName || send.accountantEmail}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {sectionCount} section{sectionCount !== 1 ? "s" : ""}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Accountant Pack</AlertDialogTitle>
            <AlertDialogDescription>
              Send your FY{selectedYear} accountant pack to{" "}
              <strong>{accountantName || accountantEmail}</strong>
              {accountantName && (
                <span className="text-muted-foreground">
                  {" "}
                  ({accountantEmail})
                </span>
              )}
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSend}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
