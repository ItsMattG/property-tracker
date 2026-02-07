"use client";

import { useState } from "react";
import { Plus, Building2, ArrowLeftRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { useRouter } from "next/navigation";
import { featureFlags } from "@/config/feature-flags";

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button size="icon" className="rounded-full h-9 w-9 cursor-pointer" aria-label="Quick add">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Quick add</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Quick Add
          </div>
          <DropdownMenuItem onClick={() => router.push("/properties/new")}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Property
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTransactionDialogOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Add Transaction
          </DropdownMenuItem>
          {featureFlags.loans && (
            <DropdownMenuItem onClick={() => router.push("/loans/new")}>
              <Banknote className="mr-2 h-4 w-4" />
              Add Loan
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AddTransactionDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
        showTrigger={false}
      />
    </>
  );
}
