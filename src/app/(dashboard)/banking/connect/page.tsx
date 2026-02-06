"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Landmark, Shield, RefreshCw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useTour } from "@/hooks/useTour";

function formatMobileForDisplay(value: string): string {
  // Strip everything except digits
  const digits = value.replace(/\D/g, "");
  // Format as 04XX XXX XXX
  if (digits.length <= 4) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
}

function toE164(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `+61${digits.slice(1)}`;
  if (digits.startsWith("61")) return `+${digits}`;
  return `+61${digits}`;
}

function isValidAuMobile(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  // Australian mobile: 04XX XXX XXX (10 digits starting with 04)
  return /^04\d{8}$/.test(digits);
}

export default function BankingConnectPage() {
  useTour({ tourId: "banking" });
  const [mobile, setMobile] = useState("");

  const connectMutation = trpc.banking.connect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(`Failed to start connection: ${error.message}`);
    },
  });

  const handleConnect = () => {
    if (!isValidAuMobile(mobile)) {
      toast.error("Please enter a valid Australian mobile number (04XX XXX XXX)");
      return;
    }
    connectMutation.mutate({ mobile: toE164(mobile) });
  };

  const isConnecting = connectMutation.isPending;

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

          <div className="border-t pt-6 space-y-2">
            <Label htmlFor="mobile">Mobile number</Label>
            <Input
              id="mobile"
              type="tel"
              placeholder="04XX XXX XXX"
              value={mobile}
              onChange={(e) => setMobile(formatMobileForDisplay(e.target.value))}
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">
              Basiq will send an SMS code to verify your identity.
            </p>
          </div>

          <Button
            data-tour="basiq-connect"
            onClick={handleConnect}
            className="w-full"
            size="lg"
            disabled={isConnecting || !isValidAuMobile(mobile)}
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
