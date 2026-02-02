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
