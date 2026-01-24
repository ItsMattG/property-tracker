"use client";

import { ChevronDown, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc/client";
import { useRouter, usePathname } from "next/navigation";

interface PropertySelectorProps {
  currentPropertyId: string;
  currentPropertyName: string;
}

export function PropertySelector({
  currentPropertyId,
  currentPropertyName,
}: PropertySelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: properties } = trpc.property.list.useQuery();

  const handlePropertySelect = (propertyId: string) => {
    // Get current sub-route (e.g., /properties/[id]/capital -> /capital)
    const pathParts = pathname.split("/");
    const subRoute = pathParts.slice(3).join("/"); // Get everything after /properties/[id]
    const newPath = subRoute
      ? `/properties/${propertyId}/${subRoute}`
      : `/properties/${propertyId}`;
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 font-medium">
          <Building2 className="h-4 w-4" />
          {currentPropertyName}
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {properties?.map((property) => (
          <DropdownMenuItem
            key={property.id}
            onClick={() => handlePropertySelect(property.id)}
            className={property.id === currentPropertyId ? "bg-accent" : ""}
          >
            <div>
              <div className="font-medium">
                {property.suburb}, {property.state}
              </div>
              <div className="text-xs text-muted-foreground">
                {property.address}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
