"use client";

import { useParams, usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { PropertySelector } from "@/components/layout/PropertySelector";

export default function PropertyDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const propertyId = params?.id as string;

  const { data: property } = trpc.property.get.useQuery(
    { id: propertyId },
    { enabled: !!propertyId }
  );

  const getBreadcrumbItems = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [
      { label: "Properties", href: "/properties" },
    ];

    if (property) {
      const propertyLabel = `${property.address}, ${property.suburb}`;

      // Check for sub-routes
      if (pathname?.includes("/capital")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Capital Gains" });
      } else if (pathname?.includes("/recurring")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Recurring" });
      } else if (pathname?.includes("/documents")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Documents" });
      } else if (pathname?.includes("/edit")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Edit" });
      } else if (pathname?.includes("/compliance")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Compliance" });
      } else if (pathname?.includes("/emails")) {
        items.push({ label: propertyLabel, href: `/properties/${propertyId}` });
        items.push({ label: "Emails" });
      } else {
        items.push({ label: propertyLabel });
      }
    }

    return items;
  };

  const propertyName = property
    ? `${property.suburb}, ${property.state}`
    : "Loading...";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Breadcrumb items={getBreadcrumbItems()} />
        {property && (
          <PropertySelector
            currentPropertyId={propertyId}
            currentPropertyName={propertyName}
          />
        )}
      </div>
      {children}
    </div>
  );
}
