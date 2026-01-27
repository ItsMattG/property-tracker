import type { TourDefinition } from "./index";

export const addPropertyTour: TourDefinition = {
  id: "add-property",
  steps: [
    {
      element: "[data-tour='address-field']",
      popover: {
        title: "Property Address",
        description: "Start typing to search. We'll auto-fill suburb, state, and postcode.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='purchase-details']",
      popover: {
        title: "Purchase Details",
        description: "Used for capital gains calculations and equity tracking.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='property-type']",
      popover: {
        title: "Property Type",
        description: "This determines which compliance rules and tax categories apply.",
        side: "top",
        align: "start",
      },
    },
  ],
};
