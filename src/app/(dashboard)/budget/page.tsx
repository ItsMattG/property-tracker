import type { Metadata } from "next";
import { BudgetClient } from "@/components/budget/BudgetClient";

export const metadata: Metadata = {
  title: "Budget | BrickTrack",
  description: "Set and track your property investment budget",
};

export default function BudgetPage() {
  return <BudgetClient />;
}
