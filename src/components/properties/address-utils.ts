interface AddressComponent {
  types: string[];
  longText?: string;
  shortText?: string;
}

export interface AddressResult {
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude: string;
  longitude: string;
}

const STATE_MAP: Record<string, string> = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "South Australia": "SA",
  "Western Australia": "WA",
  Tasmania: "TAS",
  "Northern Territory": "NT",
  "Australian Capital Territory": "ACT",
};

export function extractAddressFromComponents(
  components: AddressComponent[],
  location: { lat: number; lng: number } | null
): AddressResult {
  let streetNumber = "";
  let route = "";
  let suburb = "";
  let state = "";
  let postcode = "";

  for (const component of components) {
    const types = component.types;
    if (types.includes("street_number")) {
      streetNumber = component.longText ?? "";
    } else if (types.includes("route")) {
      route = component.longText ?? "";
    } else if (types.includes("locality")) {
      suburb = component.longText ?? "";
    } else if (types.includes("administrative_area_level_1")) {
      state =
        STATE_MAP[component.longText ?? ""] ?? component.shortText ?? "";
    } else if (types.includes("postal_code")) {
      postcode = component.longText ?? "";
    }
  }

  const address = [streetNumber, route].filter(Boolean).join(" ");

  return {
    address,
    suburb,
    state,
    postcode,
    latitude: location?.lat.toString() ?? "",
    longitude: location?.lng.toString() ?? "",
  };
}
