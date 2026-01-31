"use client";

import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc/client";
import { ChevronDown, User, Briefcase } from "lucide-react";
import { toast } from "sonner";

export function PortfolioSwitcher() {
  const router = useRouter();
  const { data: context } = trpc.team.getContext.useQuery();
  const { data: portfolios } = trpc.team.getAccessiblePortfolios.useQuery();

  const switchPortfolio = async (ownerId: string | null) => {
    // Set or clear the portfolio cookie
    if (ownerId) {
      document.cookie = `portfolio_owner_id=${ownerId};path=/;max-age=31536000`;
    } else {
      document.cookie = "portfolio_owner_id=;path=/;max-age=0";
    }
    toast.success("Switched portfolio");
    router.refresh();
  };

  // Don't show if user only has their own portfolio
  if (!portfolios || portfolios.length === 0) {
    return null;
  }

  return (
    <div className="px-3 mb-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            aria-label={`Switch portfolio. Current: ${context?.isOwnPortfolio ? "My Portfolio" : context?.ownerName || "Select portfolio"}`}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              <span className="truncate">
                {context?.isOwnPortfolio ? "My Portfolio" : context?.ownerName}
              </span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuLabel>Switch Portfolio</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => switchPortfolio(null)}>
            <User className="w-4 h-4 mr-2" />
            My Portfolio
            {context?.isOwnPortfolio && (
              <Badge variant="secondary" className="ml-auto">
                Current
              </Badge>
            )}
          </DropdownMenuItem>
          {portfolios.map((p) => (
            <DropdownMenuItem
              key={p.ownerId}
              onClick={() => switchPortfolio(p.ownerId)}
            >
              <Briefcase className="w-4 h-4 mr-2" />
              <span className="truncate">{p.ownerName}</span>
              <Badge variant="outline" className="ml-auto text-xs">
                {p.role}
              </Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {!context?.isOwnPortfolio && (
        <div className="mt-2 px-2 py-1 text-xs text-muted-foreground bg-muted rounded">
          Viewing as {context?.role}
        </div>
      )}
    </div>
  );
}
