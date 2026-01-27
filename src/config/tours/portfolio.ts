import type { TourDefinition } from "./index";

export const portfolioTour: TourDefinition = {
  id: "portfolio",
  steps: [
    {
      element: "[data-tour='property-cards']",
      popover: {
        title: "Your Properties",
        description: "Each property shows current value, equity, and growth.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='avm-estimates']",
      popover: {
        title: "Automated Valuations",
        description: "Automated valuations update monthly from market data.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='portfolio-summary']",
      popover: {
        title: "Portfolio Summary",
        description: "Your combined portfolio value, debt, and equity position.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
