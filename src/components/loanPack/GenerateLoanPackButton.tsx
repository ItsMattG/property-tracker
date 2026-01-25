"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { GenerateLoanPackModal } from "./GenerateLoanPackModal";

export function GenerateLoanPackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FileText className="mr-2 h-4 w-4" />
        Generate Loan Pack
      </Button>
      <GenerateLoanPackModal open={open} onOpenChange={setOpen} />
    </>
  );
}
