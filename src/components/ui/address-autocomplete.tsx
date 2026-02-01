"use client";

import { useRef, useEffect, useCallback } from "react";
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
  placeholder = "Start typing an address...",
  className,
  disabled,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<HTMLElement | null>(null);
  const isLoaded = useGoogleMapsLoaded();

  const parseAddressComponents = useCallback(
    (
      addressComponents: google.maps.places.AddressComponent[]
    ): ParsedAddress => {
      let streetNumber = "";
      let route = "";
      let suburb = "";
      let state = "";
      let postcode = "";

      for (const component of addressComponents) {
        const types = component.types;

        if (types.includes("street_number")) {
          streetNumber = component.longText || "";
        } else if (types.includes("route")) {
          route = component.longText || "";
        } else if (types.includes("locality")) {
          suburb = component.longText || "";
        } else if (types.includes("administrative_area_level_1")) {
          state = component.shortText || "";
        } else if (types.includes("postal_code")) {
          postcode = component.longText || "";
        }
      }

      const street = [streetNumber, route].filter(Boolean).join(" ");
      return { street, suburb, state, postcode };
    },
    []
  );

  useEffect(() => {
    if (!isLoaded || !containerRef.current || elementRef.current) return;

    // Check if PlaceAutocompleteElement is available
    if (!google.maps.places.PlaceAutocompleteElement) {
      console.error("PlaceAutocompleteElement not available");
      return;
    }

    // Create the new PlaceAutocompleteElement
    const placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({
      componentRestrictions: { country: "au" },
      types: ["address"],
    });

    // Set placeholder via the input element inside
    placeAutocomplete.setAttribute("placeholder", placeholder);

    if (disabled) {
      placeAutocomplete.setAttribute("disabled", "true");
    }

    // Listen for place selection
    placeAutocomplete.addEventListener(
      "gmp-placeselect",
      async (event: Event) => {
        const customEvent = event as CustomEvent;
        const place = customEvent.detail?.place;

        if (!place) return;

        try {
          // Fetch address components
          await place.fetchFields({
            fields: ["addressComponents", "formattedAddress"],
          });

          if (place.addressComponents) {
            const parsed = parseAddressComponents(place.addressComponents);
            onAddressSelect(parsed);
          }
        } catch (error) {
          console.error("Error fetching place details:", error);
        }
      }
    );

    // Append to container
    containerRef.current.appendChild(placeAutocomplete);
    elementRef.current = placeAutocomplete;

    return () => {
      if (elementRef.current && containerRef.current) {
        try {
          containerRef.current.removeChild(elementRef.current);
        } catch {
          // Element may already be removed
        }
        elementRef.current = null;
      }
    };
  }, [isLoaded, onAddressSelect, parseAddressComponents, placeholder, disabled]);

  // Handle disabled state changes
  useEffect(() => {
    if (elementRef.current) {
      if (disabled) {
        elementRef.current.setAttribute("disabled", "true");
      } else {
        elementRef.current.removeAttribute("disabled");
      }
    }
  }, [disabled]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "address-autocomplete-container w-full",
        "[&_gmp-place-autocomplete]:w-full",
        "[&_gmp-place-autocomplete]:block",
        "[&_input]:flex",
        "[&_input]:h-10",
        "[&_input]:w-full",
        "[&_input]:rounded-md",
        "[&_input]:border",
        "[&_input]:border-input",
        "[&_input]:bg-background",
        "[&_input]:px-3",
        "[&_input]:py-2",
        "[&_input]:text-sm",
        "[&_input]:ring-offset-background",
        "[&_input]:file:border-0",
        "[&_input]:file:bg-transparent",
        "[&_input]:file:text-sm",
        "[&_input]:file:font-medium",
        "[&_input]:placeholder:text-muted-foreground",
        "[&_input]:focus-visible:outline-none",
        "[&_input]:focus-visible:ring-2",
        "[&_input]:focus-visible:ring-ring",
        "[&_input]:focus-visible:ring-offset-2",
        "[&_input]:disabled:cursor-not-allowed",
        "[&_input]:disabled:opacity-50",
        className
      )}
    />
  );
}
