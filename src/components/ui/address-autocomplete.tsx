"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ParsedAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onAddressSelect?: (address: ParsedAddress) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  defaultValue = "",
  placeholder = "Enter street address...",
  className,
  disabled,
}: AddressAutocompleteProps) {
  return (
    <Input
      type="text"
      value={value}
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
      autoComplete="street-address"
    />
  );
}
