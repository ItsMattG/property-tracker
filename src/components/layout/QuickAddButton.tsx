"use client";

import { useState, useEffect } from "react";
import { Plus, Building2, ArrowLeftRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTransactionDialog } from "@/components/transactions/AddTransactionDialog";
import { useRouter } from "next/navigation";

export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="icon" className="rounded-full h-9 w-9">
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            Quick Add <kbd className="ml-auto text-xs">⌘K</kbd>
          </div>
          <DropdownMenuItem onClick={() => router.push("/properties/new")}>
            <Building2 className="mr-2 h-4 w-4" />
            Add Property
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTransactionDialogOpen(true)}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            Add Transaction
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/loans/new")}>
            <Banknote className="mr-2 h-4 w-4" />
            Add Loan
          </DropdownMenuItem>
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
