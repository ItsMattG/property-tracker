"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { SignIn, useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";

export function AcceptInviteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams?.get("token");
  const { isSignedIn, isLoaded } = useAuth();

  const [mutationStatus, setMutationStatus] = useState<"idle" | "success" | "error">("idle");

  const { data: inviteData, error: inviteError, isLoading: isInviteLoading } = trpc.team.getInviteByToken.useQuery(
    { token: token || "" },
    { enabled: !!token && isSignedIn }
  );

  const acceptMutation = trpc.team.acceptInvite.useMutation({
    onSuccess: () => {
      setMutationStatus("success");
      toast.success("Invitation accepted!");
      setTimeout(() => router.push("/dashboard"), 2000);
    },
    onError: (error) => {
      toast.error(error.message);
      setMutationStatus("error");
    },
  });

  const declineMutation = trpc.team.declineInvite.useMutation({
    onSuccess: () => {
      toast.success("Invitation declined");
      router.push("/dashboard");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Derive invite and status from query data directly
  const invite = inviteData ?? null;
  const isExpired = inviteError?.message.includes("expired") ?? false;
  const hasQueryError = !!inviteError && !isExpired;

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <p>Invalid invitation link</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Sign in to accept invitation</CardTitle>
              <CardDescription>
                Create an account or sign in to accept this portfolio invitation.
              </CardDescription>
            </CardHeader>
          </Card>
          <SignIn afterSignInUrl={`/invite/accept?token=${token}`} />
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Expired</h2>
            <p className="text-muted-foreground">
              This invitation has expired. Please ask the portfolio owner to send a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mutationStatus === "success") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-muted-foreground">
              Redirecting you to the dashboard...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasQueryError || mutationStatus === "error") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground">
              This invitation may be invalid or you may already be a member.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isInviteLoading || !invite) {
    return <div className="flex items-center justify-center min-h-screen">Loading invitation...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Portfolio Invitation</CardTitle>
          <CardDescription>
            {invite.ownerName} has invited you to access their portfolio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm">Your role</span>
            <Badge variant="secondary">
              {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            {invite.role === "partner"
              ? "You'll have full access to view and manage properties, transactions, and loans."
              : "You'll have read-only access to view financial data for tax and reporting purposes."}
          </p>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => declineMutation.mutate({ token: token! })}
              disabled={declineMutation.isPending}
            >
              Decline
            </Button>
            <Button
              className="flex-1"
              onClick={() => acceptMutation.mutate({ token: token! })}
              disabled={acceptMutation.isPending}
            >
              {acceptMutation.isPending ? "Accepting..." : "Accept"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
