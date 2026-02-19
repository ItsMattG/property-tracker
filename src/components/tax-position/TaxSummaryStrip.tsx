import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface TaxSummaryStripProps {
  taxableIncome: number;
  marginalRate: number;
  totalDeductions: number;
  propertySavings: number;
}

export function TaxSummaryStrip({
  taxableIncome,
  marginalRate,
  totalDeductions,
  propertySavings,
}: TaxSummaryStripProps) {
  const stats = [
    { label: "Taxable Income", value: formatCurrency(taxableIncome) },
    { label: "Marginal Rate", value: `${marginalRate}%` },
    { label: "Total Deductions", value: formatCurrency(totalDeductions) },
    { label: "Property Savings", value: formatCurrency(propertySavings) },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-semibold mt-0.5">{stat.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
