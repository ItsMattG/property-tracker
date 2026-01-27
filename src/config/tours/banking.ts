import type { TourDefinition } from "./index";

export const bankingTour: TourDefinition = {
  id: "banking",
  steps: [
    {
      element: "[data-tour='basiq-connect']",
      popover: {
        title: "Connect Your Bank",
        description: "Securely connect your bank. Read-only access with bank-level encryption.",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: "[data-tour='linked-accounts']",
      popover: {
        title: "Linked Accounts",
        description: "Your connected accounts appear here. Transactions sync automatically.",
        side: "top",
        align: "start",
      },
    },
    {
      element: "[data-tour='sender-allowlist']",
      popover: {
        title: "Email Allowlist",
        description: "Allow emails from your property manager to auto-match invoices.",
        side: "top",
        align: "start",
      },
    },
  ],
};
