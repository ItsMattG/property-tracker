# Google Places Autocomplete Design

**Date:** 2026-02-02
**Status:** Approved

## Overview

Integrate Google Places Autocomplete into the property form to auto-fill address fields (street, suburb, state, postcode) when a user selects a suggestion.

## Decisions

| Aspect | Decision |
|--------|----------|
| UX | Autocomplete dropdown, auto-fills all address fields |
| API approach | Client-side with `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` |
| Region | Australia only |
| Library | `@react-google-maps/api` |
| Error handling | Graceful degradation to plain text input |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  PropertyForm                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  AddressAutocomplete (enhanced)                   │  │
│  │  - Uses @react-google-maps/api                    │  │
│  │  - Restricts to Australia                         │  │
│  │  - Calls onAddressSelect with parsed fields       │  │
│  └───────────────────────────────────────────────────┘  │
│                         │                               │
│                         ▼                               │
│  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ suburb  │ │  state  │ │ postcode │ │ other fields │  │
│  │ (auto)  │ │ (auto)  │ │  (auto)  │ │   (manual)   │  │
│  └─────────┘ └─────────┘ └──────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. User types in AddressAutocomplete
2. Google Places API returns Australian address suggestions
3. User selects a suggestion
4. Component parses address into street, suburb, state, postcode
5. `onAddressSelect` callback fires with parsed data
6. PropertyForm updates all fields

## Files to Modify

### 1. New: `src/components/providers/google-maps-provider.tsx`

Provider component that loads the Google Maps script once at app level.

- Uses `LoadScript` from `@react-google-maps/api`
- Loads only the "places" library
- Uses `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`
- Children render immediately (script loads async)

### 2. Enhance: `src/components/ui/address-autocomplete.tsx`

Update to use Google Places Autocomplete.

- Wrap input with `<Autocomplete>` component
- Configure restrictions: `{ country: "au" }`
- Request fields: `["address_components", "formatted_address"]`
- Parse `address_components` into `ParsedAddress`

**Parsing logic:**
- `street_number` + `route` → street (e.g., "42 Wallaby Way")
- `locality` → suburb
- `administrative_area_level_1` → state (mapped to enum)
- `postal_code` → postcode

### 3. Update: `src/components/properties/PropertyForm.tsx`

Wire up the `onAddressSelect` callback to populate form fields.

```typescript
onAddressSelect={(parsed) => {
  if (parsed.suburb) setValue("suburb", parsed.suburb);
  if (parsed.state) setValue("state", parsed.state);
  if (parsed.postcode) setValue("postcode", parsed.postcode);
}}
```

### 4. Update: `src/app/(dashboard)/layout.tsx`

Wrap children with `GoogleMapsProvider`.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| API key missing/invalid | Falls back to plain text input |
| Network failure | Regular text input, no autocomplete |
| Incomplete address selected | Only available fields filled |
| Parsing fails | Field left empty for manual entry |

## Dependencies

```bash
npm install @react-google-maps/api
```

## State Mapping

Google returns full names or abbreviations. Map to enum:

| Google returns | Maps to |
|----------------|---------|
| "New South Wales" or "NSW" | NSW |
| "Victoria" or "VIC" | VIC |
| "Queensland" or "QLD" | QLD |
| "South Australia" or "SA" | SA |
| "Western Australia" or "WA" | WA |
| "Tasmania" or "TAS" | TAS |
| "Northern Territory" or "NT" | NT |
| "Australian Capital Territory" or "ACT" | ACT |

## Google Cloud Setup

### Project
bricktrack-486109

### API Key Restrictions
1. HTTP referrers only
2. Allowed domains: `localhost:3000/*`, `*.propertytracker.com.au/*`, `*.vercel.app/*`
3. Places API only

### Cost Estimate
- Autocomplete: ~$2.83 per 1000 requests
- Place Details: ~$17 per 1000 requests
- Per property add: ~$0.02
- Google provides $200/month free credit
