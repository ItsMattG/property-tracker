import type { Metadata } from "next";
import { CashFlowClient } from "@/components/cash-flow/CashFlowClient";

export const metadata: Metadata = {
  title: "Cash Flow | BrickTrack",
  description: "Track upcoming payments, income, and projected balances",
};

export default function CashFlowPage() {
  return <CashFlowClient />;
}
