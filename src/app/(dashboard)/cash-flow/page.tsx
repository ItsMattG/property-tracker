import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cash Flow | BrickTrack",
  description: "Track upcoming payments, income, and projected balances",
};

export default function CashFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Cash Flow</h2>
        <p className="text-muted-foreground">
          Track upcoming payments, income, and projected balances
        </p>
      </div>
    </div>
  );
}
