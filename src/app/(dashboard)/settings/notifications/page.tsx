"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Mail, Smartphone, Check, X, TrendingUp, Target } from "lucide-react";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function NotificationSettingsPage() {
  const utils = trpc.useUtils();
  const { status: pushStatus, subscribe, unsubscribe, isSupported } = usePushSubscription();

  const { data: preferences, isLoading } = trpc.notification.getPreferences.useQuery();
  const { data: history } = trpc.notification.getHistory.useQuery({ limit: 10 });

  const updateMutation = trpc.notification.updatePreferences.useMutation({
    onSuccess: () => {
      utils.notification.getPreferences.invalidate();
    },
  });

  const { data: milestonePrefs } = trpc.milestonePreferences.getGlobal.useQuery();
  const updateMilestoneMutation = trpc.milestonePreferences.updateGlobal.useMutation({
    onSuccess: () => {
      utils.milestonePreferences.getGlobal.invalidate();
    },
  });

  const handleToggle = (key: string, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  const handleQuietHoursChange = (field: "quietHoursStart" | "quietHoursEnd", value: string) => {
    updateMutation.mutate({ [field]: value });
  };

  const toggleLvrThreshold = (threshold: number) => {
    if (!milestonePrefs) return;
    const current = milestonePrefs.lvrThresholds as number[];
    const newThresholds = current.includes(threshold)
      ? current.filter((t) => t !== threshold)
      : [...current, threshold].sort((a, b) => b - a);
    updateMilestoneMutation.mutate({ lvrThresholds: newThresholds });
  };

  const toggleEquityThreshold = (threshold: number) => {
    if (!milestonePrefs) return;
    const current = milestonePrefs.equityThresholds as number[];
    const newThresholds = current.includes(threshold)
      ? current.filter((t) => t !== threshold)
      : [...current, threshold].sort((a, b) => a - b);
    updateMilestoneMutation.mutate({ equityThresholds: newThresholds });
  };

  const formatEquityThreshold = (value: number) => {
    return value >= 1000000 ? `$${value / 1000000}M` : `$${value / 1000}k`;
  };

  if (isLoading || !preferences) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Notification Settings</h2>
          <p className="text-muted-foreground">Manage how you receive notifications</p>
        </div>
        <div className="h-96 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Notification Settings</h2>
        <p className="text-muted-foreground">Manage how you receive notifications</p>
      </div>

      {/* Channels */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notification Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Smartphone className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <Label>Push Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {pushStatus === "subscribed" && "Enabled"}
                  {pushStatus === "prompt" && "Click to enable"}
                  {pushStatus === "denied" && "Blocked by browser"}
                  {pushStatus === "unsupported" && "Not supported"}
                  {pushStatus === "loading" && "Loading..."}
                </p>
              </div>
            </div>
            {isSupported && pushStatus !== "denied" && (
              <Button
                variant={pushStatus === "subscribed" ? "outline" : "default"}
                size="sm"
                onClick={() => pushStatus === "subscribed" ? unsubscribe() : subscribe()}
              >
                {pushStatus === "subscribed" ? "Disable" : "Enable"}
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Mail className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <Label>Email Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  {preferences.emailEnabled ? "Enabled" : "Disabled"}
                </p>
              </div>
            </div>
            <Button
              variant={preferences.emailEnabled ? "outline" : "default"}
              size="sm"
              onClick={() => handleToggle("emailEnabled", !preferences.emailEnabled)}
            >
              {preferences.emailEnabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notify Me About</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { key: "rentReceived", label: "Rent received", description: "When rental income is detected" },
              { key: "syncFailed", label: "Bank sync failed", description: "When bank connection needs attention" },
              { key: "anomalyDetected", label: "Anomalies detected", description: "Unusual transactions or missed rent" },
              { key: "weeklyDigest", label: "Weekly digest", description: "Sunday morning portfolio summary" },
              { key: "taskReminders", label: "Task reminders", description: "Get notified when tasks are approaching their due date" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2">
                <div>
                  <Label>{item.label}</Label>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggle(item.key, !preferences[item.key as keyof typeof preferences])}
                >
                  {preferences[item.key as keyof typeof preferences] ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quiet Hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quiet Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Push notifications won't be sent during these hours
          </p>
          <div className="flex items-center gap-4">
            <div>
              <Label htmlFor="quietStart">From</Label>
              <Input
                id="quietStart"
                type="time"
                value={preferences.quietHoursStart}
                onChange={(e) => handleQuietHoursChange("quietHoursStart", e.target.value)}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="quietEnd">To</Label>
              <Input
                id="quietEnd"
                type="time"
                value={preferences.quietHoursEnd}
                onChange={(e) => handleQuietHoursChange("quietHoursEnd", e.target.value)}
                className="w-32"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Equity Milestones */}
      {milestonePrefs && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Equity Milestones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable milestone notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when properties hit equity milestones
                </p>
              </div>
              <Button
                variant={milestonePrefs.enabled ? "outline" : "default"}
                size="sm"
                onClick={() => updateMilestoneMutation.mutate({ enabled: !milestonePrefs.enabled })}
              >
                {milestonePrefs.enabled ? "Disable" : "Enable"}
              </Button>
            </div>

            {milestonePrefs.enabled && (
              <>
                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" />
                    LVR Thresholds
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Notify when LVR drops below these levels
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[80, 60, 40, 20].map((threshold) => (
                      <Badge
                        key={threshold}
                        variant={(milestonePrefs.lvrThresholds as number[]).includes(threshold) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleLvrThreshold(threshold)}
                      >
                        {threshold}%
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4" />
                    Equity Thresholds
                  </Label>
                  <p className="text-sm text-muted-foreground mb-3">
                    Notify when equity rises above these amounts
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[100000, 250000, 500000, 1000000].map((threshold) => (
                      <Badge
                        key={threshold}
                        variant={(milestonePrefs.equityThresholds as number[]).includes(threshold) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleEquityThreshold(threshold)}
                      >
                        {formatEquityThreshold(threshold)}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Notifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {entry.channel === "email" ? (
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="capitalize">{entry.type.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.sentAt), { addSuffix: true })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
