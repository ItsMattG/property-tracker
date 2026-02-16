"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
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

export type { AddressResult };

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
  placeId: string;
  mainText: string;
  secondaryText: string;
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
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isApiReady, setIsApiReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) return;
    loadGoogleMapsScript()
      .then(() => setIsApiReady(true))
      .catch(() => {
        /* Graceful degradation — input works as plain text */
      });
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
      if (!isApiReady || input.length < 3) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      setIsLoading(true);

      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current =
            new google.maps.places.AutocompleteSessionToken();
        }

        const { suggestions: results } =
          await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
            {
              input,
              sessionToken: sessionTokenRef.current,
              includedPrimaryTypes: ["address"],
              region: "au",
            }
          );

        // Stale request guard
        if (currentRequestId !== requestIdRef.current) return;

        const mapped: Suggestion[] = results
          .filter(
            (
              s
            ): s is typeof s & {
              placePrediction: NonNullable<typeof s.placePrediction>;
            } => s.placePrediction != null
          )
          .map((s) => ({
            placeId: s.placePrediction.placeId,
            mainText: s.placePrediction.mainText?.toString() ?? "",
            secondaryText: s.placePrediction.secondaryText?.toString() ?? "",
            placePrediction: s.placePrediction,
          }));

        setSuggestions(mapped);
        setIsOpen(mapped.length > 0);
        setHighlightedIndex(-1);
      } catch {
        // Silently degrade — input still works as plain text
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [isApiReady]
  );

  const handleSelect = useCallback(
    async (suggestion: Suggestion) => {
      setIsOpen(false);
      setSuggestions([]);
      setIsLoading(true);

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
        onChange(result.address);
        onAddressSelected(result);
      } catch {
        // If place details fetch fails, set the raw text
        onChange(suggestion.mainText);
      } finally {
        setIsLoading(false);
      }

      // Reset session token after selection (new session for next search)
      sessionTokenRef.current = null;
    },
    [onChange, onAddressSelected]
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
            i < suggestions.length - 1 ? i + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((i) =>
            i > 0 ? i - 1 : suggestions.length - 1
          );
          break;
        case "Enter":
          if (highlightedIndex >= 0) {
            e.preventDefault();
            handleSelect(suggestions[highlightedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, highlightedIndex, handleSelect]
  );

  // Scroll active item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[role="option"]');
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const listboxId = "address-autocomplete-listbox";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={GOOGLE_PLACES_API_KEY ? placeholder : "123 Smith Street"}
          name={name}
          onBlur={(e) => {
            // Delay closing so mousedown on suggestion fires first
            setTimeout(() => setIsOpen(false), 150);
            onBlur?.();
          }}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={isOpen ? listboxId : undefined}
          aria-activedescendant={
            highlightedIndex >= 0
              ? `suggestion-${highlightedIndex}`
              : undefined
          }
        />
        {isLoading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-[300px] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.placeId}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === highlightedIndex}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm select-none transition-colors",
                index === highlightedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50"
              )}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <MapPin className="w-4 h-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 truncate">
                <span className="font-medium">{suggestion.mainText}</span>
                {suggestion.secondaryText && (
                  <span className="text-muted-foreground ml-1.5">
                    {suggestion.secondaryText}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
