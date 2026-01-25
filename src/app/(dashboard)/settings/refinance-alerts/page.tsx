"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2, Bell, Home } from "lucide-react";
import { useCallback, useMemo } from "react";

interface LoanAlertConfig {
  loanId: string;
  enabled: boolean;
  rateGapThreshold: string;
  notifyOnCashRateChange: boolean;
}

function LoanAlertCard({
  loan,
  onUpdate,
}: {
  loan: {
    id: string;
    lender: string;
    interestRate: string;
    property?: { address: string } | null;
  };
  onUpdate: (config: LoanAlertConfig) => void;
}) {
  const { data: config, isLoading } = trpc.loanComparison.getAlertConfig.useQuery({
    loanId: loan.id,
  });

  // Derive values from config with defaults - no local state needed for initial sync
  const currentValues = useMemo(() => ({
    enabled: config?.enabled ?? false,
    threshold: config ? parseFloat(config.rateGapThreshold) : 0.5,
    cashRateNotify: config?.notifyOnCashRateChange ?? true,
  }), [config]);

  const handleFieldUpdate = useCallback((updates: Partial<{
    enabled: boolean;
    threshold: number;
    cashRateNotify: boolean;
  }>) => {
    onUpdate({
      loanId: loan.id,
      enabled: updates.enabled ?? currentValues.enabled,
      rateGapThreshold: (updates.threshold ?? currentValues.threshold).toFixed(2),
      notifyOnCashRateChange: updates.cashRateNotify ?? currentValues.cashRateNotify,
    });
  }, [loan.id, currentValues, onUpdate]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-muted rounded-lg">
            <Home className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{loan.property?.address || "Unknown Property"}</CardTitle>
            <CardDescription>
              {loan.lender} - {parseFloat(loan.interestRate).toFixed(2)}%
            </CardDescription>
          </div>
          <Switch
            checked={currentValues.enabled}
            onCheckedChange={(checked) => handleFieldUpdate({ enabled: checked })}
          />
        </div>
      </CardHeader>
      {currentValues.enabled && (
        <CardContent className="space-y-4 pt-0">
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Alert when rate gap exceeds</Label>
              <span className="text-sm font-medium">{currentValues.threshold.toFixed(2)}%</span>
            </div>
            <Slider
              value={[currentValues.threshold]}
              onValueCommit={([value]) => handleFieldUpdate({ threshold: value })}
              min={0.25}
              max={1}
              step={0.05}
            />
            <p className="text-xs text-muted-foreground">
              You will be notified when your rate is this much above market
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Notify on RBA rate changes</Label>
              <p className="text-xs text-muted-foreground">
                Get notified when the cash rate changes
              </p>
            </div>
            <Switch
              checked={currentValues.cashRateNotify}
              onCheckedChange={(checked) => handleFieldUpdate({ cashRateNotify: checked })}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default function RefinanceAlertsPage() {
  const { data: loans, isLoading: loansLoading } = trpc.loan.list.useQuery();
  const utils = trpc.useUtils();

  const updateConfig = trpc.loanComparison.updateAlertConfig.useMutation({
    onSuccess: (_, variables) => {
      utils.loanComparison.getAlertConfig.invalidate({ loanId: variables.loanId });
    },
  });

  const handleUpdate = useCallback(
    (config: LoanAlertConfig) => {
      updateConfig.mutate(config);
    },
    [updateConfig]
  );

  if (loansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Refinance Alerts</h1>
        <p className="text-muted-foreground">
          Get notified when better loan rates are available
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5" />
            <div>
              <CardTitle>How it works</CardTitle>
              <CardDescription>
                We monitor your loan rates against estimated market rates and alert you when refinancing could save money.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {!loans || loans.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No loans found. Add a loan to enable alerts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {loans.map((loan) => (
            <LoanAlertCard key={loan.id} loan={loan} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
