"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useGoogleMapsLoaded } from "@/components/providers/GoogleMapsProvider";
import { cn } from "@/lib/utils";

export interface ParsedAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

interface AddressAutocompleteProps {
  onAddressSelect: (address: ParsedAddress) => void;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  onAddressSelect,
  defaultValue = "",
  placeholder = "Start typing an address...",
  className,
  disabled,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(defaultValue);
  const isLoaded = useGoogleMapsLoaded();

  const parseAddressComponents = useCallback(
    (place: google.maps.places.PlaceResult): ParsedAddress => {
      const components = place.address_components || [];

      let streetNumber = "";
      let route = "";
      let suburb = "";
      let state = "";
      let postcode = "";

      for (const component of components) {
        const types = component.types;

        if (types.includes("street_number")) {
          streetNumber = component.long_name;
        } else if (types.includes("route")) {
          route = component.long_name;
        } else if (types.includes("locality")) {
          suburb = component.long_name;
        } else if (types.includes("administrative_area_level_1")) {
          // Use short_name for state (NSW, VIC, etc.)
          state = component.short_name;
        } else if (types.includes("postal_code")) {
          postcode = component.long_name;
        }
      }

      // Combine street number and route for full street address
      const street = [streetNumber, route].filter(Boolean).join(" ");

      return { street, suburb, state, postcode };
    },
    []
  );

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    // Initialize autocomplete
    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "formatted_address"],
      types: ["address"],
    });

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();

      if (place.address_components) {
        const parsed = parseAddressComponents(place);
        setInputValue(place.formatted_address || parsed.street);
        onAddressSelect(parsed);
      }
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onAddressSelect, parseAddressComponents]);

  // Update input value when defaultValue changes
  useEffect(() => {
    setInputValue(defaultValue);
  }, [defaultValue]);

  return (
    <Input
      ref={inputRef}
      type="text"
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      placeholder={placeholder}
      className={cn(className)}
      disabled={disabled}
      autoComplete="off"
    />
  );
}
