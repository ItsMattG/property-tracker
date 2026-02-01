import type { TourDefinition } from "./index";

export const dashboardTour: TourDefinition = {
  id: "dashboard",
  steps: [
    {
      element: "[data-tour='sidebar-nav']",
      popover: {
        title: "Navigation",
        description: "Navigate between properties, banking, transactions, and reports.",
        side: "right",
        align: "start",
      },
    },
    {
      element: "[data-tour='portfolio-summary']",
      popover: {
        title: "Portfolio Overview",
        description: "Your total portfolio value and equity at a glance.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='setup-checklist']",
      popover: {
        title: "Setup Progress",
        description: "Track your progress here. Complete all steps to get the most out of BrickTrack.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='quick-actions']",
      popover: {
        title: "Quick Actions",
        description: "Add properties, record expenses, or view reports from here.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
