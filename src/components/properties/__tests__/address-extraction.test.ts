import { describe, it, expect } from "vitest";
import { extractAddressFromComponents } from "../address-utils";

describe("extractAddressFromComponents", () => {
  it("extracts full Australian address", () => {
    const components = [
      { types: ["street_number"], longText: "42", shortText: "42" },
      { types: ["route"], longText: "Smith Street", shortText: "Smith St" },
      { types: ["locality"], longText: "Sydney", shortText: "Sydney" },
      {
        types: ["administrative_area_level_1"],
        longText: "New South Wales",
        shortText: "NSW",
      },
      { types: ["postal_code"], longText: "2000", shortText: "2000" },
    ];
    const location = { lat: -33.8688, lng: 151.2093 };

    const result = extractAddressFromComponents(components, location);

    expect(result).toEqual({
      address: "42 Smith Street",
      suburb: "Sydney",
      state: "NSW",
      postcode: "2000",
      latitude: "-33.8688",
      longitude: "151.2093",
    });
  });

  it("handles missing street number", () => {
    const components = [
      { types: ["route"], longText: "King Road", shortText: "King Rd" },
      { types: ["locality"], longText: "Melbourne", shortText: "Melbourne" },
      {
        types: ["administrative_area_level_1"],
        longText: "Victoria",
        shortText: "VIC",
      },
      { types: ["postal_code"], longText: "3000", shortText: "3000" },
    ];

    const result = extractAddressFromComponents(components, null);

    expect(result).toEqual({
      address: "King Road",
      suburb: "Melbourne",
      state: "VIC",
      postcode: "3000",
      latitude: "",
      longitude: "",
    });
  });

  it("maps long state names to abbreviations", () => {
    const components = [
      { types: ["street_number"], longText: "1", shortText: "1" },
      { types: ["route"], longText: "Test St", shortText: "Test St" },
      { types: ["locality"], longText: "Brisbane", shortText: "Brisbane" },
      {
        types: ["administrative_area_level_1"],
        longText: "Queensland",
        shortText: "QLD",
      },
      { types: ["postal_code"], longText: "4000", shortText: "4000" },
    ];

    const result = extractAddressFromComponents(components, {
      lat: -27.47,
      lng: 153.02,
    });
    expect(result.state).toBe("QLD");
  });

  it("falls back to shortText for unknown state names", () => {
    const components = [
      { types: ["street_number"], longText: "1", shortText: "1" },
      { types: ["route"], longText: "Test St", shortText: "Test St" },
      { types: ["locality"], longText: "Somewhere", shortText: "Somewhere" },
      {
        types: ["administrative_area_level_1"],
        longText: "Some Unknown State",
        shortText: "XX",
      },
      { types: ["postal_code"], longText: "9999", shortText: "9999" },
    ];

    const result = extractAddressFromComponents(components, null);
    expect(result.state).toBe("XX");
  });

  it("returns empty fields for empty components", () => {
    const result = extractAddressFromComponents([], null);

    expect(result).toEqual({
      address: "",
      suburb: "",
      state: "",
      postcode: "",
      latitude: "",
      longitude: "",
    });
  });
});
