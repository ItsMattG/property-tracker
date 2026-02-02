"use client";

import { useRef, useCallback } from "react";
import { Autocomplete } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useGoogleMaps } from "@/components/providers/google-maps-provider";
import { parseGooglePlaceResult } from "@/lib/address-utils";

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
  onAddressSelect,
  defaultValue = "",
  placeholder = "Start typing an address...",
  className,
  disabled,
}: AddressAutocompleteProps) {
  const { isLoaded } = useGoogleMaps();
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    if (!place.address_components) return;

    const parsed = parseGooglePlaceResult(place);

    // Update the input value with formatted address or street
    const displayValue = parsed.street || place.formatted_address || "";
    onChange?.(displayValue);

    // Fire callback with parsed address components
    onAddressSelect?.(parsed);
  }, [onChange, onAddressSelect]);

  // Fallback to regular input if Google Maps isn't loaded
  if (!isLoaded) {
    return (
      <Input
        ref={inputRef}
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

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        componentRestrictions: { country: "au" },
        fields: ["address_components", "formatted_address"],
        types: ["address"],
      }}
    >
      <Input
        ref={inputRef}
        type="text"
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(className)}
        disabled={disabled}
      />
    </Autocomplete>
  );
}
