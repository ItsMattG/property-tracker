"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Smartphone, Check, AlertCircle } from "lucide-react";

export default function MobileSettingsPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: hasPassword, refetch, isLoading } = trpc.user.hasMobilePassword.useQuery();

  const setMobilePassword = trpc.user.setMobilePassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setMobilePassword.mutate({ password });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold">Mobile App Access</h2>
          <p className="text-muted-foreground">
            Set up a password to access BrickTrack from the mobile app
          </p>
        </div>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Mobile App Access</h2>
        <p className="text-muted-foreground">
          Set up a password to access BrickTrack from the mobile app
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Mobile Password
          </CardTitle>
          <CardDescription>
            This password is used only for mobile app login. Your web login
            remains unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPassword && (
            <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Mobile password is set. You can update it below.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">
                {hasPassword ? "New Password" : "Password"}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm text-red-700 dark:text-red-400">
                  {error}
                </span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700 dark:text-green-400">
                  Mobile password {hasPassword ? "updated" : "set"} successfully
                </span>
              </div>
            )}

            <Button type="submit" disabled={setMobilePassword.isPending}>
              {setMobilePassword.isPending
                ? "Saving..."
                : hasPassword
                  ? "Update Password"
                  : "Set Password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Download the BrickTrack mobile app from the App Store or Google Play</p>
          <p>2. Open the app and tap &quot;Sign In&quot;</p>
          <p>3. Enter your email address and the mobile password you set above</p>
          <p className="pt-2 text-xs">
            Note: The mobile password is separate from your web login for security.
            If you forget it, you can always reset it here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
