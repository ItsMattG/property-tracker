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
import { MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react";
import { format } from "date-fns";

interface LoanCardProps {
  loan: {
    id: string;
    lender: string;
    loanType: string;
    rateType: string;
    currentBalance: string;
    interestRate: string;
    repaymentAmount: string;
    repaymentFrequency: string;
    fixedRateExpiry: string | null;
    property: { address: string; suburb: string } | null;
  };
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LoanCard({ loan, onEdit, onDelete }: LoanCardProps) {
  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(parseFloat(amount));
  };

  const formatLoanType = (type: string) => {
    return type === "principal_and_interest" ? "P&I" : "Interest Only";
  };

  const formatRateType = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{loan.lender}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {loan.property?.address}, {loan.property?.suburb}
            </p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
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
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{formatLoanType(loan.loanType)}</Badge>
            <Badge variant="outline">{formatRateType(loan.rateType)}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Balance</span>
              <p className="font-semibold">{formatCurrency(loan.currentBalance)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Interest Rate</span>
              <p className="font-semibold">{loan.interestRate}%</p>
            </div>
            <div>
              <span className="text-muted-foreground">Repayment</span>
              <p className="font-semibold">
                {formatCurrency(loan.repaymentAmount)}/{loan.repaymentFrequency}
              </p>
            </div>
            {loan.fixedRateExpiry && (
              <div>
                <span className="text-muted-foreground">Fixed Until</span>
                <p className="font-semibold">
                  {format(new Date(loan.fixedRateExpiry), "dd MMM yyyy")}
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
