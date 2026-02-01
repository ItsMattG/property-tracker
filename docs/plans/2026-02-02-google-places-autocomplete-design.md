# Google Places Address Autocomplete

**Date:** 2026-02-02
**Status:** Approved

## Overview

Add Google Places Autocomplete to all address input fields. When users start typing an address, suggestions appear. Selecting a suggestion auto-fills street, suburb, state, and postcode fields.

## Component Architecture

### New Component
`src/components/ui/address-autocomplete.tsx`

- Built on existing `Input` component
- Uses Google Places Autocomplete (New) API
- Restricted to Australian addresses
- Returns structured address components
- Integrates with react-hook-form via callback

### Props Interface
```typescript
interface AddressAutocompleteProps {
  onAddressSelect: (address: {
    street: string;
    suburb: string;
    state: string;
    postcode: string;
  }) => void;
  defaultValue?: string;
  placeholder?: string;
}
```

### Usage Example
```tsx
<AddressAutocomplete
  onAddressSelect={(addr) => {
    form.setValue("address", addr.street);
    form.setValue("suburb", addr.suburb);
    form.setValue("state", addr.state);
    form.setValue("postcode", addr.postcode);
  }}
/>
```

## Technical Implementation

### Dependencies
```bash
npm install @react-google-maps/api
```

### Environment Variable
```
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
```

### Implementation Details
- Load Google Maps script once via provider at app level
- Debounced input (300ms)
- Filter to Australia: `componentRestrictions: { country: 'au' }`
- On selection, call `getDetails()` to extract components
- Map Google's `address_components`:
  - `street_number` + `route` → street address
  - `locality` → suburb
  - `administrative_area_level_1` → state (NSW, VIC, etc.)
  - `postal_code` → postcode

### Fallback
If API fails to load, component degrades to regular text input.

## Integration Points

### Primary
- `src/components/properties/PropertyForm.tsx`
- `src/components/onboarding/EnhancedWizard.tsx`
- `src/components/onboarding/OnboardingWizard.tsx`

### Secondary
- `src/components/similar-properties/AddListingModal.tsx`

### Provider
- Add `GoogleMapsProvider` in `src/app/layout.tsx`

## Google Cloud Setup

### Project
bricktrack-486109

### Steps
1. Enable "Places API (New)"
2. Create API Key
3. Restrict key:
   - HTTP referrers only
   - `localhost:3000/*`, `*.propertytracker.com.au/*`, `*.vercel.app/*`
   - Places API (New) only

### Cost Estimate
- Autocomplete: ~$2.83 per 1000 requests
- Place Details: ~$17 per 1000 requests
- Per property add: ~$0.02
- Google provides $200/month free credit
