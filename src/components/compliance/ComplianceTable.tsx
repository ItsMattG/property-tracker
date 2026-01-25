"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";
import { ExternalLink } from "lucide-react";

interface ComplianceItem {
  propertyId: string;
  propertyAddress: string;
  requirementName: string;
  nextDueAt: string | null;
  status: string;
}

interface ComplianceTableProps {
  items: ComplianceItem[];
  showProperty?: boolean;
}

export function ComplianceTable({ items, showProperty = true }: ComplianceTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No compliance items to display
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showProperty && <TableHead>Property</TableHead>}
          <TableHead>Requirement</TableHead>
          <TableHead>Next Due</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.propertyId}-${item.requirementName}-${index}`}>
            {showProperty && (
              <TableCell>
                <Link
                  href={`/properties/${item.propertyId}`}
                  className="hover:underline"
                >
                  {item.propertyAddress}
                </Link>
              </TableCell>
            )}
            <TableCell className="font-medium">{item.requirementName}</TableCell>
            <TableCell>
              {item.nextDueAt
                ? format(new Date(item.nextDueAt), "dd MMM yyyy")
                : "Never recorded"}
            </TableCell>
            <TableCell>
              <ComplianceStatusBadge status={item.status as any} />
            </TableCell>
            <TableCell className="text-right">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/properties/${item.propertyId}/compliance`}>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
