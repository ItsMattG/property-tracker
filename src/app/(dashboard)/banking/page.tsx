"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc/client";
import {
  Landmark,
  Plus,
  AlertTriangle,
  ChevronDown,
  Building2,
  Pencil,
  Trash2,
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ConnectionAlertBanner } from "@/components/banking/ConnectionAlertBanner";
import { SyncButton } from "@/components/banking/SyncButton";
import { AccountStatusIndicator } from "@/components/banking/AccountStatusIndicator";
import { toast } from "sonner";

function EditableName({
  accountId,
  nickname,
  accountName,
  onSave,
}: {
  accountId: string;
  nickname: string | null;
  accountName: string;
  onSave: (accountId: string, nickname: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(nickname ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const displayName = nickname || accountName;

  const handleSave = () => {
    setEditing(false);
    const trimmed = value.trim();
    const newNickname = trimmed === "" || trimmed === accountName ? null : trimmed;
    if (newNickname !== nickname) {
      onSave(accountId, newNickname);
    }
  };

  return (
    <div className="h-6 flex items-center">
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setValue(nickname ?? "");
              setEditing(false);
            }
          }}
          placeholder={accountName}
          className="font-medium border-b border-primary bg-transparent outline-none text-sm h-6 leading-6"
        />
      ) : (
        <button
          onClick={() => {
            setValue(nickname ?? "");
            setEditing(true);
          }}
          className="font-medium truncate flex items-center gap-1.5 group hover:text-primary transition-colors h-6 leading-6"
          title="Click to rename"
        >
          {displayName}
          <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
        </button>
      )}
    </div>
  );
}

const alertTypeMessages: Record<string, string> = {
  disconnected: "Account disconnected — reconnect to resume syncing",
  requires_reauth: "Re-authentication required — your bank session has expired",
  sync_failed: "Sync failed — try again or reconnect your account",
};

function formatCurrency(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(num);
}

export default function BankingPage() {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.banking.listAccounts.useQuery();
  const { data: summaries } = trpc.banking.getAccountSummaries.useQuery();
  const { data: alerts } = trpc.banking.listAlerts.useQuery();
  const { data: properties } = trpc.property.list.useQuery();

  const syncAccount = trpc.banking.syncAccount.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced ${data.transactionsAdded} new transactions`);
      utils.banking.listAccounts.invalidate();
      utils.banking.getAccountSummaries.invalidate();
      utils.banking.listAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
      utils.banking.listAccounts.invalidate();
      utils.banking.listAlerts.invalidate();
    },
  });

  const dismissAlert = trpc.banking.dismissAlert.useMutation({
    onSuccess: () => {
      utils.banking.listAlerts.invalidate();
    },
  });

  const reconnect = trpc.banking.reconnect.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const renameInstitution = trpc.banking.renameInstitution.useMutation({
    onSuccess: () => {
      toast.success("Institution renamed");
      utils.banking.listAccounts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const renameAccount = trpc.banking.renameAccount.useMutation({
    onSuccess: () => {
      toast.success("Account renamed");
      utils.banking.listAccounts.invalidate();
      utils.banking.getAccountSummaries.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const linkAccount = trpc.banking.linkAccountToProperty.useMutation({
    onSuccess: () => {
      toast.success("Property updated");
      utils.banking.listAccounts.invalidate();
      utils.banking.getAccountSummaries.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const removeAccount = trpc.banking.removeAccount.useMutation({
    onSuccess: () => {
      toast.success("Account removed");
      utils.banking.listAccounts.invalidate();
      utils.banking.getAccountSummaries.invalidate();
      utils.banking.listAlerts.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleDismissAllAlerts = async () => {
    if (!alerts) return;
    for (const alert of alerts) {
      await dismissAlert.mutateAsync({ alertId: alert.id });
    }
  };

  const hasAuthError =
    alerts?.some((a) => a.alertType === "requires_reauth") ?? false;

  // Compute totals from summaries
  const totals = useMemo(() => {
    if (!summaries) return null;
    const totalReconciled = summaries.reduce(
      (sum, s) => sum + parseFloat(s.reconciledBalance),
      0
    );
    const totalBankBalance = summaries.reduce(
      (sum, s) => sum + (s.bankBalance ? parseFloat(s.bankBalance) : 0),
      0
    );
    const totalCashIn = summaries.reduce(
      (sum, s) => sum + parseFloat(s.cashIn),
      0
    );
    const totalCashOut = summaries.reduce(
      (sum, s) => sum + parseFloat(s.cashOut),
      0
    );
    const totalUnreconciled = summaries.reduce(
      (sum, s) => sum + s.unreconciledCount,
      0
    );
    return { totalReconciled, totalBankBalance, totalCashIn, totalCashOut, totalUnreconciled };
  }, [summaries]);

  // Group accounts by institution
  const groupedAccounts = useMemo(() => {
    if (!accounts) return [];
    const groups = new Map<
      string,
      typeof accounts
    >();
    for (const account of accounts) {
      const key = account.institution;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(account);
    }
    return Array.from(groups.entries()).map(([institution, accts]) => ({
      institution,
      institutionNickname: accts[0]?.institutionNickname ?? null,
      accounts: accts.sort((a, b) => a.accountName.localeCompare(b.accountName)),
    }));
  }, [accounts]);

  // Build a map from account ID to summary for quick lookup
  const summaryMap = useMemo(() => {
    if (!summaries) return new Map<string, NonNullable<typeof summaries>[0]>();
    return new Map(summaries.map((s) => [s.id, s]));
  }, [summaries]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Bank Feeds</h2>
            <p className="text-muted-foreground">
              Manage your connected bank accounts
            </p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {alerts && alerts.length > 0 && (
        <ConnectionAlertBanner
          alertCount={alerts.length}
          hasAuthError={hasAuthError}
          onDismiss={handleDismissAllAlerts}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bank Feeds</h2>
          <p className="text-muted-foreground">
            {accounts?.length ?? 0} account{accounts?.length !== 1 ? "s" : ""}{" "}
            across {groupedAccounts.length} institution
            {groupedAccounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        {accounts && accounts.length > 0 && (
          <Button asChild>
            <Link href="/banking/connect">
              <Plus className="w-4 h-4 mr-2" />
              Connect Bank
            </Link>
          </Button>
        )}
      </div>

      {/* Summary stats */}
      {totals && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Wallet className="w-4 h-4" />
                BrickTrack Balance
              </div>
              <div className="text-xl font-semibold">
                {formatCurrency(totals.totalReconciled)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <Landmark className="w-4 h-4" />
                Bank Balance
              </div>
              <div className="text-xl font-semibold">
                {totals.totalBankBalance > 0
                  ? formatCurrency(totals.totalBankBalance)
                  : <span className="text-muted-foreground text-sm">Not available</span>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ArrowUpRight className="w-4 h-4 text-success" />
                Cash In (This Month)
              </div>
              <div className="text-xl font-semibold text-success">
                {formatCurrency(totals.totalCashIn)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                <ArrowDownRight className="w-4 h-4 text-destructive" />
                Cash Out (This Month)
              </div>
              <div className="text-xl font-semibold text-destructive">
                {formatCurrency(Math.abs(totals.totalCashOut))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {groupedAccounts.length > 0 ? (
        <div className="space-y-4">
          {groupedAccounts.map(({ institution, institutionNickname, accounts: institutionAccounts }) => (
            <Collapsible key={institution} defaultOpen>
              <Card>
                <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Landmark className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <div onClick={(e) => e.stopPropagation()}>
                        <EditableName
                          accountId={institution}
                          nickname={institutionNickname}
                          accountName={institution}
                          onSave={(_id, nick) =>
                            renameInstitution.mutate({
                              institution,
                              nickname: nick,
                            })
                          }
                        />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {institutionAccounts.length} account
                        {institutionAccounts.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                  <CollapsibleTrigger asChild>
                    <button className="p-1 rounded hover:bg-muted transition-colors cursor-pointer">
                      <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                </div>

                <CollapsibleContent>
                  <div className="border-t divide-y">
                    {institutionAccounts.map((account) => {
                      const accountAlerts = alerts?.filter(
                        (a) => a.bankAccountId === account.id
                      );
                      const needsReauth = accountAlerts?.some(
                        (a) => a.alertType === "requires_reauth"
                      );
                      const summary = summaryMap.get(account.id);

                      return (
                        <div
                          key={account.id}
                          className="p-4 space-y-3"
                        >
                          {/* Top row: name + status + actions */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <EditableName
                                  accountId={account.id}
                                  nickname={account.nickname ?? null}
                                  accountName={account.accountName}
                                  onSave={(id, nick) =>
                                    renameAccount.mutate({
                                      accountId: id,
                                      nickname: nick,
                                    })
                                  }
                                />
                                <AccountStatusIndicator
                                  status={
                                    account.connectionStatus as
                                      | "connected"
                                      | "disconnected"
                                      | "error"
                                  }
                                />
                                <Badge variant="outline" className="text-xs">
                                  {account.accountType}
                                </Badge>
                                {accountAlerts && accountAlerts.length > 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Badge
                                          variant="destructive"
                                          className="gap-1 text-xs"
                                        >
                                          <AlertTriangle className="w-3 h-3" />
                                          {accountAlerts.length}
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-xs bg-red-900 text-white">
                                        {accountAlerts.map((alert, i) => (
                                          <p key={alert.id ?? i}>
                                            {alertTypeMessages[alert.alertType] ??
                                              "This account has an issue that needs attention"}
                                          </p>
                                        ))}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                {account.accountNumberMasked && (
                                  <span>{account.accountNumberMasked}</span>
                                )}
                                <span>
                                  {account.lastSyncedAt
                                    ? `Synced ${formatDistanceToNow(new Date(account.lastSyncedAt), { addSuffix: true })}`
                                    : "Never synced"}
                                </span>
                              </div>
                            </div>

                            {/* Property assignment */}
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-foreground" />
                              <Select
                                value={account.defaultPropertyId ?? "none"}
                                onValueChange={(value) =>
                                  linkAccount.mutate({
                                    accountId: account.id,
                                    propertyId:
                                      value === "none" ? null : value,
                                  })
                                }
                              >
                                <SelectTrigger className="w-[180px]" size="sm">
                                  <SelectValue placeholder="Assign property" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">
                                    Unassigned
                                  </SelectItem>
                                  {properties?.map((property) => (
                                    <SelectItem
                                      key={property.id}
                                      value={property.id}
                                    >
                                      {property.suburb}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {needsReauth ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    reconnect.mutate({
                                      accountId: account.id,
                                    })
                                  }
                                >
                                  Reconnect
                                </Button>
                              ) : (
                                <SyncButton
                                  onSync={() =>
                                    syncAccount.mutateAsync({
                                      accountId: account.id,
                                    })
                                  }
                                  lastManualSyncAt={account.lastManualSyncAt}
                                />
                              )}
                              <AlertDialog>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-muted-foreground hover:text-destructive"
                                          disabled={removeAccount.isPending}
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent>Remove account</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remove account</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Remove &ldquo;{account.nickname || account.accountName}&rdquo;? This will also delete all imported transactions for this account.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() => removeAccount.mutate({ accountId: account.id })}
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {/* Bottom row: balance summary + reconcile CTA */}
                          {summary && (
                            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-2.5">
                              <div className="flex items-center gap-6 text-sm">
                                <div>
                                  <span className="text-muted-foreground">BrickTrack: </span>
                                  <span className="font-medium">
                                    {formatCurrency(summary.reconciledBalance)}
                                  </span>
                                </div>
                                {summary.bankBalance && (
                                  <div>
                                    <span className="text-muted-foreground">Bank: </span>
                                    <span className="font-medium">
                                      {formatCurrency(summary.bankBalance)}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">In: </span>
                                  <span className="font-medium text-success">
                                    {formatCurrency(summary.cashIn)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Out: </span>
                                  <span className="font-medium text-destructive">
                                    {formatCurrency(Math.abs(parseFloat(summary.cashOut)))}
                                  </span>
                                </div>
                              </div>
                              <div>
                                {summary.unreconciledCount > 0 ? (
                                  <Button size="sm" asChild>
                                    <Link href={`/banking/${account.id}/reconcile`}>
                                      Reconcile {summary.unreconciledCount} Item{summary.unreconciledCount !== 1 ? "s" : ""}
                                    </Link>
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-sm text-success">
                                    <CheckCircle2 className="w-4 h-4" />
                                    All reconciled
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Landmark className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">No bank accounts connected</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Connect your bank account to automatically import transactions for
            your investment properties.
          </p>
          <Button asChild className="mt-4">
            <Link href="/banking/connect">
              <Plus className="w-4 h-4 mr-2" />
              Connect Your Bank
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
