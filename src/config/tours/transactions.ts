import type { TourDefinition } from "./index";

export const transactionsTour: TourDefinition = {
  id: "transactions",
  steps: [
    {
      element: "[data-tour='transaction-list']",
      popover: {
        title: "Transactions",
        description: "Imported transactions from your connected banks appear here.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='category-dropdown']",
      popover: {
        title: "Categories",
        description: "Categorize each transaction for accurate tax reporting.",
        side: "left",
        align: "start",
      },
    },
    {
      element: "[data-tour='bulk-actions']",
      popover: {
        title: "Bulk Actions",
        description: "Select multiple transactions to categorize or assign in bulk.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='filters']",
      popover: {
        title: "Filters",
        description: "Filter by property, category, date range, or status.",
        side: "bottom",
        align: "start",
      },
    },
  ],
};
