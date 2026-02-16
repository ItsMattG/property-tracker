"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { extractAddressFromComponents } from "./address-utils";
import type { AddressResult } from "./address-utils";

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelected: (result: AddressResult) => void;
  placeholder?: string;
  name?: string;
  onBlur?: () => void;
}

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

// Module-level script loading state
let scriptLoaded = false;
let scriptLoading = false;
const loadCallbacks: Array<() => void> = [];

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (!GOOGLE_PLACES_API_KEY)
    return Promise.reject(new Error("No Google Places API key"));

  return new Promise((resolve, reject) => {
    if (scriptLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    scriptLoading = true;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&v=weekly`;
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      scriptLoading = false;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
}

interface Suggestion {
  text: string;
  placePrediction: google.maps.places.PlacePrediction;
}

export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelected,
  placeholder = "Start typing an address...",
  name,
  onBlur,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoaded, setIsLoaded] = useState(false);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) return;
    loadGoogleMapsScript()
      .then(() => setIsLoaded(true))
      .catch(() => {
        /* Graceful degradation — input works as plain text */
      });
  }, []);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      if (!isLoaded || input.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current =
            new google.maps.places.AutocompleteSessionToken();
        }

        const response =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              input,
              sessionToken: sessionTokenRef.current,
              includedPrimaryTypes: ["address"],
              region: "au",
            }
          );

        const mapped = response.suggestions
          .filter(
            (s): s is typeof s & { placePrediction: NonNullable<typeof s.placePrediction> } =>
              s.placePrediction != null
          )
          .map((s) => ({
            text: s.placePrediction.text.text,
            placePrediction: s.placePrediction,
          }));

        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
        setIsOpen(false);
      }
    },
    [isLoaded]
  );

  const handleSelect = useCallback(
    async (suggestion: Suggestion) => {
      setIsOpen(false);
      setSuggestions([]);

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ["addressComponents", "location"],
        });

        const components = (place.addressComponents ?? []).map((c) => ({
          types: c.types,
          longText: c.longText ?? undefined,
          shortText: c.shortText ?? undefined,
        }));

        const location = place.location
          ? { lat: place.location.lat(), lng: place.location.lng() }
          : null;

        const result = extractAddressFromComponents(components, location);
        onAddressSelected(result);
      } catch {
        // If place details fetch fails, set the raw text
        onChange(suggestion.text);
      }

      // Reset session token after selection (new session for next search)
      sessionTokenRef.current = null;
    },
    [onAddressSelected, onChange]
  );

  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => fetchSuggestions(newValue),
        300
      );
    },
    [onChange, fetchSuggestions]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((i) =>
            Math.min(i + 1, suggestions.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          if (highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          break;
      }
    },
    [isOpen, suggestions, highlightedIndex, handleSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={GOOGLE_PLACES_API_KEY ? placeholder : "123 Smith Street"}
        name={name}
        onBlur={() => {
          // Delay closing so mousedown on suggestion fires first
          setTimeout(() => setIsOpen(false), 150);
          onBlur?.();
        }}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        aria-controls={isOpen ? "address-suggestions" : undefined}
      />
      {isOpen && suggestions.length > 0 && (
        <ul
          id="address-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.text}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "cursor-pointer px-3 py-2 text-sm",
                index === highlightedIndex &&
                  "bg-accent text-accent-foreground"
              )}
              onMouseDown={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {suggestion.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
