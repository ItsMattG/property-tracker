"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, Building2 } from "lucide-react";
import { format } from "date-fns";

interface LoanCardProps {
  loan: {
    id: string;
    lender: string;
    loanType: string;
    rateType: string;
    currentBalance: string;
    originalAmount: string;
    interestRate: string;
    repaymentAmount: string;
    repaymentFrequency: string;
    fixedRateExpiry: string | null;
    property: { address: string; suburb: string } | null;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const formatCurrency = (amount: string) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(parseFloat(amount));

export function LoanCard({ loan, onEdit, onDelete }: LoanCardProps) {
  const paidOff =
    parseFloat(loan.originalAmount) > 0
      ? ((1 - parseFloat(loan.currentBalance) / parseFloat(loan.originalAmount)) * 100)
      : 0;
  const paidOffPct = Math.max(0, Math.min(100, paidOff));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base leading-snug">
              {loan.lender}
            </CardTitle>
            {loan.property && (
              <p className="text-sm text-muted-foreground truncate">
                {loan.property.address}, {loan.property.suburb}
              </p>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(loan.id)}>
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(loan.id)}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Balance + progress */}
        <div>
          <p className="text-2xl font-bold tracking-tight">
            {formatCurrency(loan.currentBalance)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${paidOffPct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {paidOffPct.toFixed(0)}% paid
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-3 gap-3 pt-1 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Rate</p>
            <p className="text-sm font-semibold tabular-nums">
              {loan.interestRate}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Repayment</p>
            <p className="text-sm font-semibold tabular-nums">
              {formatCurrency(loan.repaymentAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frequency</p>
            <p className="text-sm font-semibold capitalize">
              {loan.repaymentFrequency}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {loan.loanType === "principal_and_interest"
              ? "P&I"
              : "Interest Only"}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">
            {loan.rateType}
          </Badge>
          {loan.fixedRateExpiry && (
            <Badge variant="outline" className="text-xs">
              Fixed until {format(new Date(loan.fixedRateExpiry), "MMM yyyy")}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
