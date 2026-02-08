"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertySelect } from "@/components/properties/PropertySelect";
import { ArrowLeft, Landmark, Shield, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useTour } from "@/hooks/useTour";

export default function BankingConnectPage() {
  useTour({ tourId: "banking" });
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

  const { data: properties, isLoading: propertiesLoading } = trpc.property.list.useQuery();

  // Auto-select if only one property
  useEffect(() => {
    if (properties?.length === 1 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const connectMutation = trpc.banking.connect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to start connection: ${error.message}`);
    },
  });

  const handleConnect = () => {
    if (!selectedPropertyId) {
      toast.error("Please select a property for this bank account");
      return;
    }
    connectMutation.mutate({
      propertyId: selectedPropertyId,
    });
  };

  const isConnecting = connectMutation.isPending;
  const hasMultipleProperties = (properties?.length ?? 0) > 1;
  const hasNoProperties = !propertiesLoading && properties?.length === 0;
  const canConnect = !!selectedPropertyId && !isConnecting;

  // Redirect to create property if none exist
  if (hasNoProperties) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/banking">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <Home className="w-12 h-12 text-muted-foreground mx-auto" />
            <h2 className="text-lg font-semibold">Add a property first</h2>
            <p className="text-muted-foreground">
              You need at least one property before connecting a bank account.
              Transactions will be linked to your property automatically.
            </p>
            <Button asChild>
              <Link href="/properties/new">Add Property</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/banking">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <CardTitle>Connect Your Bank</CardTitle>
          <CardDescription>
            Securely connect your bank account to automatically import
            transactions for your investment properties.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary">
              <Shield className="w-6 h-6 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Bank-grade security</h4>
                <p className="text-sm text-muted-foreground">
                  We use Basiq, a regulated open banking provider. Your login
                  credentials are never stored or seen by BrickTrack.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary">
              <RefreshCw className="w-6 h-6 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Automatic syncing</h4>
                <p className="text-sm text-muted-foreground">
                  Transactions are automatically imported and categorized. No
                  more manual data entry or CSV uploads.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t pt-6" data-tour="linked-accounts">
            <h4 className="font-medium mb-3">Supported banks</h4>
            <p className="text-sm text-muted-foreground mb-4">
              All major Australian banks are supported, including:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Commonwealth Bank",
                "ANZ",
                "Westpac",
                "NAB",
                "Macquarie",
                "ING",
                "Bendigo Bank",
                "Bank of Queensland",
                "Suncorp",
              ].map((bank) => (
                <span
                  key={bank}
                  className="px-3 py-1 rounded-full bg-muted text-sm"
                >
                  {bank}
                </span>
              ))}
            </div>
          </div>

          {/* Property selection - shown for multi-property users */}
          {hasMultipleProperties && (
            <div className="border-t pt-6 space-y-2">
              <Label htmlFor="property">Property</Label>
              <PropertySelect
                value={selectedPropertyId}
                onValueChange={setSelectedPropertyId}
                placeholder="Which property is this account for?"
                triggerClassName="w-full"
              />
              <p className="text-xs text-muted-foreground">
                All connected accounts will be linked to this property. You can reassign individual accounts later.
              </p>
            </div>
          )}

          <Button
            data-tour="basiq-connect"
            onClick={handleConnect}
            className="w-full"
            size="lg"
            disabled={!canConnect}
          >
            {isConnecting ? "Connecting..." : "Connect Bank Account"}
          </Button>

          <p className="text-xs text-center text-muted-foreground" data-tour="sender-allowlist">
            By connecting your account, you agree to our{" "}
            <Link href="/terms" className="underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
