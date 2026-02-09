"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";

interface AddressResult {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: string;
  longitude: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (result: AddressResult) => void;
  placeholder?: string;
  name?: string;
  onBlur?: () => void;
}

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

// Map Google's abbreviated state names to our enum values
const STATE_MAP: Record<string, string> = {
  "New South Wales": "NSW",
  "Victoria": "VIC",
  "Queensland": "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  "Tasmania": "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadGooglePlacesScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (!GOOGLE_PLACES_API_KEY) return Promise.reject(new Error("No Google Places API key"));

  return new Promise((resolve) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  });
}

function extractAddressComponents(
  place: google.maps.places.PlaceResult
): AddressResult | null {
  if (!place.address_components) return null;

  let streetNumber = "";
  let route = "";
  let suburb = "";
  let state = "";
  let postcode = "";

  for (const component of place.address_components) {
    const types = component.types;
    if (types.includes("street_number")) {
      streetNumber = component.long_name;
    } else if (types.includes("route")) {
      route = component.long_name;
    } else if (types.includes("locality")) {
      suburb = component.long_name;
    } else if (types.includes("administrative_area_level_1")) {
      state = STATE_MAP[component.long_name] || component.short_name;
    } else if (types.includes("postal_code")) {
      postcode = component.long_name;
    }
  }

  const address = [streetNumber, route].filter(Boolean).join(" ");
  const lat = place.geometry?.location?.lat();
  const lng = place.geometry?.location?.lng();

  return {
    address,
    suburb,
    state,
    postcode,
    latitude: lat?.toString() ?? "",
    longitude: lng?.toString() ?? "",
  };
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelected,
  placeholder = "Start typing an address...",
  name,
  onBlur,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(scriptLoaded);

  const handlePlaceChanged = useCallback(() => {
    const autocomplete = autocompleteRef.current;
    if (!autocomplete) return;

    const place = autocomplete.getPlace();
    const result = extractAddressComponents(place);
    if (result) {
      onAddressSelected(result);
    }
  }, [onAddressSelected]);

  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) return;

    loadGooglePlacesScript().then(() => {
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "au" },
      fields: ["address_components", "geometry"],
      types: ["address"],
    });

    autocomplete.addListener("place_changed", handlePlaceChanged);
    autocompleteRef.current = autocomplete;

    return () => {
      google.maps.event.clearInstanceListeners(autocomplete);
    };
  }, [isLoaded, handlePlaceChanged]);

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={GOOGLE_PLACES_API_KEY ? placeholder : "123 Smith Street"}
      name={name}
      onBlur={onBlur}
      autoComplete="off"
    />
  );
}
