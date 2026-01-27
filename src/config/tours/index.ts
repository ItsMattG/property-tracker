import type { DriveStep } from "driver.js";

export interface TourDefinition {
  id: string;
  steps: DriveStep[];
}

export { dashboardTour } from "./dashboard";
export { addPropertyTour } from "./add-property";
export { bankingTour } from "./banking";
export { transactionsTour } from "./transactions";
export { portfolioTour } from "./portfolio";

export const TOUR_PAGE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/properties/new": "add-property",
  "/banking/connect": "banking",
  "/transactions": "transactions",
  "/portfolio": "portfolio",
};
