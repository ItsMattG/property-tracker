"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { useTour } from "@/hooks/useTour";
import { TOUR_PAGE_MAP } from "@/config/tours";

export function HelpButton() {
  const pathname = usePathname();
  const tourId = pathname ? TOUR_PAGE_MAP[pathname] : undefined;

  const { startTour } = useTour({
    tourId: tourId || "",
    autoStart: false,
  });

  if (!tourId) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={startTour}
      title="Take a tour of this page"
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}
