"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc/client";

const CREATE_NEW_VALUE = "__create_new__";

interface PropertySelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  children?: React.ReactNode;
}

export function PropertySelect({
  value,
  onValueChange,
  placeholder = "Select property",
  triggerClassName,
  children,
}: PropertySelectProps) {
  const router = useRouter();
  const { data: properties } = trpc.property.list.useQuery();

  return (
    <Select
      value={value}
      onValueChange={(val) => {
        if (val === CREATE_NEW_VALUE) {
          router.push("/properties/new");
          return;
        }
        onValueChange(val);
      }}
    >
      {children ?? (
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      )}
      <SelectContent>
        {properties?.map((property) => (
          <SelectItem key={property.id} value={property.id}>
            {property.address}, {property.suburb}
          </SelectItem>
        ))}
        {(properties?.length ?? 0) > 0 && <SelectSeparator />}
        <SelectItem value={CREATE_NEW_VALUE} className="text-muted-foreground">
          <Plus className="size-4" />
          Add property
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
