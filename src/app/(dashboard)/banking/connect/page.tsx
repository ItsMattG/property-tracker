"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft, Landmark, Shield, RefreshCw, Smartphone } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc/client";
import { useTour } from "@/hooks/useTour";

const mobileSchema = z.object({
  mobile: z
    .string()
    .min(1, "Mobile number is required")
    .transform((val) => val.replace(/[\s\-()]/g, ""))
    .refine(
      (val) => /^(\+?61|0)4\d{8}$/.test(val),
      "Enter a valid Australian mobile number (e.g. 0412 345 678)"
    )
    .transform((val) =>
      val.startsWith("0")
        ? `+61${val.slice(1)}`
        : val.startsWith("614")
          ? `+${val}`
          : val
    ),
});

type MobileForm = z.infer<typeof mobileSchema>;

export default function BankingConnectPage() {
  useTour({ tourId: "banking" });
  const searchParams = useSearchParams();
  const propertyId = searchParams?.get("propertyId") ?? undefined;

  const [showMobileInput, setShowMobileInput] = useState(false);

  const form = useForm<MobileForm>({
    resolver: zodResolver(mobileSchema),
    defaultValues: { mobile: "" },
  });

  const connectMutation = trpc.banking.connect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      if (error.message === "MOBILE_REQUIRED") {
        setShowMobileInput(true);
        return;
      }
      toast.error(`Failed to start connection: ${error.message}`);
    },
  });

  const isConnecting = connectMutation.isPending;

  function handleConnect() {
    connectMutation.mutate({ propertyId });
  }

  function handleMobileSubmit(data: MobileForm) {
    connectMutation.mutate({ propertyId, mobile: data.mobile });
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

          {showMobileInput ? (
            <div className="animate-slide-down-reveal">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">Mobile verification required</h4>
                    <p className="text-xs text-muted-foreground">
                      Your bank requires SMS verification. Enter your Australian mobile number to continue.
                    </p>
                  </div>
                </div>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleMobileSubmit)} className="space-y-3">
                    <FormField
                      control={form.control}
                      name="mobile"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Mobile number</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="0412 345 678"
                              type="tel"
                              autoFocus
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={isConnecting}
                    >
                      {isConnecting ? "Connecting..." : "Continue"}
                    </Button>
                  </form>
                </Form>
              </div>
            </div>
          ) : (
            <Button
              data-tour="basiq-connect"
              onClick={handleConnect}
              className="w-full"
              size="lg"
              disabled={isConnecting}
            >
              {isConnecting ? "Connecting..." : "Connect Bank Account"}
            </Button>
          )}

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
