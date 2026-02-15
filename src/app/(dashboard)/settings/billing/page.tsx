"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Zap, Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    features: [
      "1 investment property",
      "Basic tracking",
      "Climate risk data",
      "Property valuations",
    ],
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$14/mo",
    features: [
      "Unlimited properties",
      "Bank feeds & auto-categorisation",
      "Tax reports & MyTax export",
      "Email forwarding",
      "AI chat assistant",
      "Document extraction",
    ],
  },
  {
    id: "team" as const,
    name: "Team",
    price: "$29/mo",
    features: [
      "Everything in Pro",
      "Team members & advisors",
      "Audit log",
      "Priority support",
      "Broker portal access",
    ],
  },
];

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Billing</h2>
          <p className="text-muted-foreground">Loading billing details...</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-48 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    }>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const { data: subscription, isLoading } =
    trpc.billing.getSubscription.useQuery();
  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (searchParams?.get("success") === "true") {
      toast.success("Subscription activated! Welcome to Pro.");
      utils.billing.getSubscription.invalidate();
    }
    if (searchParams?.get("canceled") === "true") {
      toast.info("Checkout cancelled.");
    }
  }, [searchParams, utils]);

  const currentPlan = subscription?.plan ?? "free";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Billing</h2>
          <p className="text-muted-foreground">Loading billing details...</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="h-48 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Billing</h2>
        <p className="text-muted-foreground">
          Manage your subscription and billing details
        </p>
      </div>

      {/* Current plan status */}
      {subscription?.status &&
        subscription.status !== "active" &&
        currentPlan !== "free" && (
          <Card className="border-yellow-500">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-600">
                Your subscription status is{" "}
                <strong>{subscription.status}</strong>.
                {subscription.cancelAtPeriodEnd &&
                  subscription.currentPeriodEnd && (
                    <>
                      {" "}
                      Access continues until{" "}
                      {format(
                        new Date(subscription.currentPeriodEnd),
                        "MMMM d, yyyy"
                      )}
                      .
                    </>
                  )}
              </p>
            </CardContent>
          </Card>
        )}

      {/* Plan cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          const isUpgrade =
            plan.id !== "free" && !isCurrent && currentPlan === "free";
          const isDowngrade = plan.id === "free" && currentPlan !== "free";

          return (
            <Card
              key={plan.id}
              className={`flex flex-col ${isCurrent ? "border-primary" : ""}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {isCurrent && <Badge>Current</Badge>}
                </div>
                <p className="text-2xl font-bold">{plan.price}</p>
              </CardHeader>
              <CardContent className="flex flex-col flex-1">
                <ul className="space-y-2 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>

                <div className="mt-6">
                  {isUpgrade && (
                    <Button
                      className="w-full"
                      onClick={() =>
                        checkout.mutate({
                          plan: plan.id as "pro" | "team",
                        })
                      }
                      disabled={checkout.isPending}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Upgrade to {plan.name}
                    </Button>
                  )}

                  {isCurrent && currentPlan !== "free" && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => portal.mutate()}
                      disabled={portal.isPending}
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Manage Subscription
                    </Button>
                  )}

                  {isDowngrade && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => portal.mutate()}
                      disabled={portal.isPending}
                    >
                      Manage Subscription
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manage billing */}
      {currentPlan !== "free" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Billing Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Update payment method, view invoices, or cancel your subscription.
            </p>
            <Button
              variant="outline"
              onClick={() => portal.mutate()}
              disabled={portal.isPending}
            >
              Open Customer Portal
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
