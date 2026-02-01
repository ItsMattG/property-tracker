"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  Plus,
  Building2,
  Users,
  Landmark,
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";

const entityTypeIcons = {
  personal: Building2,
  trust: Users,
  smsf: Landmark,
  company: Briefcase,
};

const entityTypeLabels = {
  personal: "Personal",
  trust: "Trust",
  smsf: "SMSF",
  company: "Company",
};

interface EntitySwitcherProps {
  isCollapsed?: boolean;
}

export function EntitySwitcher({ isCollapsed = false }: EntitySwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const { data: entities, isLoading } = trpc.entity.list.useQuery();
  const { data: activeEntity } = trpc.entity.getActive.useQuery();

  const handleSwitch = async (entityId: string) => {
    await fetch("/api/entity/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityId }),
    });

    setOpen(false);
    router.refresh();
  };

  if (isLoading) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(
          "justify-between",
          isCollapsed ? "w-10 h-10 p-0" : "w-[200px]"
        )}
      >
        {isCollapsed ? (
          <Building2 className="h-4 w-4" />
        ) : (
          <span className="text-muted-foreground">Loading...</span>
        )}
      </Button>
    );
  }

  if (!entities || entities.length === 0) {
    return (
      <Button
        variant="outline"
        className={cn(
          "justify-between",
          isCollapsed ? "w-10 h-10 p-0" : "w-[200px]"
        )}
        onClick={() => router.push("/entities/new")}
      >
        {isCollapsed ? (
          <Plus className="h-4 w-4" />
        ) : (
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            <span>Create Entity</span>
          </div>
        )}
      </Button>
    );
  }

  const Icon = activeEntity
    ? entityTypeIcons[activeEntity.type]
    : Building2;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between",
            isCollapsed ? "w-10 h-10 p-0" : "w-[200px]"
          )}
          aria-label={`Switch entity. Current: ${activeEntity?.name || "Select Entity"}`}
        >
          {isCollapsed ? (
            <Icon className="h-4 w-4" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="truncate">
                  {activeEntity?.name || "Select Entity"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px]" align="start">
        {entities?.map((entity) => {
          const TypeIcon = entityTypeIcons[entity.type];
          const isActive = activeEntity?.id === entity.id;

          return (
            <DropdownMenuItem
              key={entity.id}
              onClick={() => handleSwitch(entity.id)}
              className={cn(
                "flex items-center gap-2",
                isActive && "bg-accent"
              )}
            >
              <TypeIcon className="h-4 w-4" />
              <span className="flex-1 truncate">{entity.name}</span>
              <Badge variant="secondary" className="text-xs">
                {entityTypeLabels[entity.type]}
              </Badge>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/entities/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Entity
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
