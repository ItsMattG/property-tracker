"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Calendar, DollarSign, MoreVertical, FileText } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { Property } from "@/server/db/schema";
import { trpc } from "@/lib/trpc/client";

// When serialized through tRPC, Date fields become strings
type SerializedProperty = Omit<Property, "createdAt" | "updatedAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
};

interface PropertyCardProps {
  property: SerializedProperty;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function PropertyCard({ property, onEdit, onDelete }: PropertyCardProps) {
  const utils = trpc.useUtils();

  const handlePrefetch = () => {
    utils.property.get.prefetch({ id: property.id });
  };

  const formattedPrice = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(Number(property.purchasePrice));

  return (
    <Link
      href={`/properties/${property.id}`}
      onMouseEnter={handlePrefetch}
      className="block"
    >
      <Card className="hover:border-primary transition-colors">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">{property.address}</CardTitle>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {property.suburb}, {property.state} {property.postcode}
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); onEdit?.(property.id); }}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem asChild onClick={(e) => e.preventDefault()}>
              <Link href={`/properties/${property.id}/documents`}>
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.preventDefault(); onDelete?.(property.id); }}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <span>{formattedPrice}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{format(new Date(property.purchaseDate), "MMM yyyy")}</span>
          </div>
        </div>
        <div className="mt-3">
          <Badge variant="secondary">{property.entityName}</Badge>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
