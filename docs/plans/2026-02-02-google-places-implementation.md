# Google Places Autocomplete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Places autocomplete to the property form so users can search for addresses and auto-fill suburb, state, and postcode.

**Architecture:** Client-side Google Places integration using `@react-google-maps/api`. A provider loads the script once at dashboard level. The `AddressAutocomplete` component wraps Google's Autocomplete, parses address components, and fires a callback to populate form fields.

**Tech Stack:** Next.js 16, React, @react-google-maps/api, react-hook-form

---

## Task 1: Install @react-google-maps/api

**Files:**
- Modify: `package.json`

**Step 1: Install the dependency**

```bash
cd ~/worktrees/property-tracker/google-places
npm install @react-google-maps/api
```

**Step 2: Verify installation**

```bash
grep "@react-google-maps/api" package.json
```

Expected: `"@react-google-maps/api": "^2.x.x"`

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-google-maps/api for address autocomplete"
```

---

## Task 2: Create GoogleMapsProvider

**Files:**
- Create: `src/components/providers/google-maps-provider.tsx`

**Step 1: Create the provider component**

```typescript
"use client";

import { useLoadScript, Libraries } from "@react-google-maps/api";
import { createContext, useContext, ReactNode } from "react";

const libraries: Libraries = ["places"];

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
});

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

interface GoogleMapsProviderProps {
  children: ReactNode;
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey || "",
    libraries,
  });

  // Warn in dev if key is missing
  if (!apiKey && typeof window !== "undefined") {
    console.warn(
      "NEXT_PUBLIC_GOOGLE_PLACES_API_KEY is not set. Address autocomplete will not work."
    );
  }

  return (
    <GoogleMapsContext.Provider value={{ isLoaded, loadError }}>
      {children}
    </GoogleMapsContext.Provider>
  );
}
```

**Step 2: Verify file compiles**

```bash
cd ~/worktrees/property-tracker/google-places
npx tsc --noEmit src/components/providers/google-maps-provider.tsx 2>&1 || npm run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/providers/google-maps-provider.tsx
git commit -m "feat: add GoogleMapsProvider for Places API script loading"
```

---

## Task 3: Add GoogleMapsProvider to Dashboard Layout

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Import and wrap with GoogleMapsProvider**

Add import at top:
```typescript
import { GoogleMapsProvider } from "@/components/providers/google-maps-provider";
```

Wrap the return JSX (inside ChatProvider):
```typescript
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ChatProvider>
      <GoogleMapsProvider>
        <SidebarProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
              <Header />
              <main className="flex-1 p-6 bg-secondary">{children}</main>
            </div>
          </div>
        </SidebarProvider>
        <ChatButton />
        <LazyChatPanel />
      </GoogleMapsProvider>
    </ChatProvider>
  );
}
```

**Step 2: Verify build**

```bash
cd ~/worktrees/property-tracker/google-places
npm run build 2>&1 | tail -20
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git commit -m "feat: add GoogleMapsProvider to dashboard layout"
```

---

## Task 4: Create State Mapping Utility

**Files:**
- Create: `src/lib/address-utils.ts`

**Step 1: Create the utility file**

```typescript
// Maps Google's administrative_area_level_1 to our state enum values
const STATE_MAP: Record<string, string> = {
  "New South Wales": "NSW",
  NSW: "NSW",
  Victoria: "VIC",
  VIC: "VIC",
  Queensland: "QLD",
  QLD: "QLD",
  "South Australia": "SA",
  SA: "SA",
  "Western Australia": "WA",
  WA: "WA",
  Tasmania: "TAS",
  TAS: "TAS",
  "Northern Territory": "NT",
  NT: "NT",
  "Australian Capital Territory": "ACT",
  ACT: "ACT",
};

export function mapGoogleStateToEnum(googleState: string): string | undefined {
  return STATE_MAP[googleState];
}

export interface ParsedGoogleAddress {
  street: string;
  suburb: string;
  state: string;
  postcode: string;
}

export function parseGooglePlaceResult(
  place: google.maps.places.PlaceResult
): ParsedGoogleAddress {
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
      state = mapGoogleStateToEnum(component.short_name) || component.short_name;
    } else if (types.includes("postal_code")) {
      postcode = component.long_name;
    }
  }

  // Combine street number and route
  const street = [streetNumber, route].filter(Boolean).join(" ");

  return { street, suburb, state, postcode };
}
```

**Step 2: Verify file compiles**

```bash
cd ~/worktrees/property-tracker/google-places
npm run lint -- --ext .ts src/lib/address-utils.ts 2>&1 | tail -10
```

Expected: No errors (may have type warning for google.maps - that's OK, it's a global type)

**Step 3: Commit**

```bash
git add src/lib/address-utils.ts
git commit -m "feat: add address parsing utilities for Google Places"
```

---

## Task 5: Enhance AddressAutocomplete Component

**Files:**
- Modify: `src/components/ui/address-autocomplete.tsx`

**Step 1: Replace the component with Google Places integration**

```typescript
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
```

**Step 2: Verify build**

```bash
cd ~/worktrees/property-tracker/google-places
npm run build 2>&1 | tail -20
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/ui/address-autocomplete.tsx
git commit -m "feat: integrate Google Places Autocomplete into AddressAutocomplete"
```

---

## Task 6: Wire Up PropertyForm to Use onAddressSelect

**Files:**
- Modify: `src/components/properties/PropertyForm.tsx`

**Step 1: Add onAddressSelect handler**

Find the AddressAutocomplete in the form and add the onAddressSelect prop:

```typescript
<AddressAutocomplete
  value={field.value}
  onChange={field.onChange}
  placeholder="Start typing an address..."
  onAddressSelect={(parsed) => {
    if (parsed.suburb) {
      form.setValue("suburb", parsed.suburb);
    }
    if (parsed.state && ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"].includes(parsed.state)) {
      form.setValue("state", parsed.state as typeof states[number]);
    }
    if (parsed.postcode) {
      form.setValue("postcode", parsed.postcode);
    }
  }}
/>
```

**Step 2: Verify build**

```bash
cd ~/worktrees/property-tracker/google-places
npm run build 2>&1 | tail -20
```

Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/properties/PropertyForm.tsx
git commit -m "feat: auto-fill suburb, state, postcode from address autocomplete"
```

---

## Task 7: Add Google Maps Types

**Files:**
- Modify: `tsconfig.json` (if needed)

**Step 1: Install Google Maps types**

```bash
cd ~/worktrees/property-tracker/google-places
npm install -D @types/google.maps
```

**Step 2: Verify types resolve**

```bash
cd ~/worktrees/property-tracker/google-places
npx tsc --noEmit 2>&1 | head -20
```

Expected: No type errors related to google.maps

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @types/google.maps for type checking"
```

---

## Task 8: Final Verification

**Step 1: Run full build**

```bash
cd ~/worktrees/property-tracker/google-places
npm run build
```

Expected: Build succeeds

**Step 2: Run lint**

```bash
cd ~/worktrees/property-tracker/google-places
npm run lint
```

Expected: No new errors (existing warnings OK)

**Step 3: Manual test (dev server)**

```bash
cd ~/worktrees/property-tracker/google-places
npm run dev
```

Test: Navigate to /properties/new, type an address, verify:
- Autocomplete suggestions appear (Australia only)
- Selecting fills suburb, state, postcode fields
- Form still submits correctly

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Install @react-google-maps/api |
| 2 | Create GoogleMapsProvider |
| 3 | Add provider to dashboard layout |
| 4 | Create address parsing utilities |
| 5 | Enhance AddressAutocomplete with Places |
| 6 | Wire up PropertyForm auto-fill |
| 7 | Add Google Maps types |
| 8 | Final verification |
