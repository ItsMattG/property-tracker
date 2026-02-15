"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LoanPackSnapshot } from "@/server/services/lending/loan-pack";
import { Building2, TrendingUp, TrendingDown, Shield, Trophy, Wallet } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/utils";

export function LoanPackReport({ data }: { data: LoanPackSnapshot }) {
  const { portfolio, income, expenses, compliance, milestones, cashFlow } = data;

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Portfolio Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-muted-foreground">Total Value</p><p className="text-2xl font-bold">{formatCurrency(portfolio.totals.totalValue)}</p></div>
            <div><p className="text-sm text-muted-foreground">Total Debt</p><p className="text-2xl font-bold">{formatCurrency(portfolio.totals.totalDebt)}</p></div>
            <div><p className="text-sm text-muted-foreground">Total Equity</p><p className="text-2xl font-bold text-green-600">{formatCurrency(portfolio.totals.totalEquity)}</p></div>
            <div><p className="text-sm text-muted-foreground">Average LVR</p><p className="text-2xl font-bold">{formatPercent(portfolio.totals.avgLvr)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Properties */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Properties ({portfolio.properties.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {portfolio.properties.map((property, idx) => (
            <div key={idx} className="border rounded-lg p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-medium">{property.address}</p>
                  <p className="text-sm text-muted-foreground">{property.suburb}, {property.state} {property.postcode}</p>
                </div>
                <Badge variant={property.lvr <= 80 ? "default" : "secondary"}>{formatPercent(property.lvr)} LVR</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div><p className="text-muted-foreground">Current Value</p><p className="font-medium">{formatCurrency(property.currentValue)}</p></div>
                <div><p className="text-muted-foreground">Equity</p><p className="font-medium text-green-600">{formatCurrency(property.equity)}</p></div>
                <div><p className="text-muted-foreground">Purchase Price</p><p className="font-medium">{formatCurrency(property.purchasePrice)}</p></div>
                <div><p className="text-muted-foreground">Contract Date</p><p className="font-medium">{property.purchaseDate}</p></div>
              </div>
              {property.loans.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Loans</p>
                  <div className="space-y-2">
                    {property.loans.map((loan, lIdx) => (
                      <div key={lIdx} className="flex justify-between text-sm">
                        <span>{loan.lender}</span>
                        <span>{formatCurrency(loan.balance)} @ {loan.rate}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Income */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-green-600" /> Income</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><p className="text-sm text-muted-foreground">Monthly Rent</p><p className="text-xl font-bold">{formatCurrency(income.monthlyRent)}</p></div>
            <div><p className="text-sm text-muted-foreground">Annual Rent</p><p className="text-xl font-bold">{formatCurrency(income.annualRent)}</p></div>
          </div>
          {income.byProperty.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">By Property</p>
              {income.byProperty.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm"><span className="text-muted-foreground">{item.address}</span><span>{formatCurrency(item.monthlyRent)}/mo</span></div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5 text-red-600" /> Expenses</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><p className="text-sm text-muted-foreground">Monthly Average</p><p className="text-xl font-bold">{formatCurrency(expenses.totalMonthly)}</p></div>
            <div><p className="text-sm text-muted-foreground">Annual Total</p><p className="text-xl font-bold">{formatCurrency(expenses.totalAnnual)}</p></div>
          </div>
          {expenses.categories.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">By Category</p>
              {expenses.categories.map((cat, idx) => (
                <div key={idx} className="flex justify-between text-sm"><span className="text-muted-foreground">{cat.name}</span><span>{formatCurrency(cat.annual)}/yr</span></div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Flow */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Cash Flow</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-sm text-muted-foreground">Monthly Net</p><p className={`text-xl font-bold ${cashFlow.monthlyNet >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(cashFlow.monthlyNet)}</p></div>
            <div><p className="text-sm text-muted-foreground">Annual Net</p><p className={`text-xl font-bold ${cashFlow.annualNet >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(cashFlow.annualNet)}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance */}
      {compliance.items.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Compliance Status</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant="default">{compliance.summary.compliant} Compliant</Badge>
              {compliance.summary.upcoming > 0 && <Badge variant="secondary">{compliance.summary.upcoming} Upcoming</Badge>}
              {compliance.summary.overdue > 0 && <Badge variant="destructive">{compliance.summary.overdue} Overdue</Badge>}
            </div>
            <div className="space-y-2">
              {compliance.items.slice(0, 5).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{item.property} - {item.type}</span>
                  <Badge variant={item.status === "compliant" ? "default" : item.status === "overdue" ? "destructive" : "secondary"}>{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-yellow-500" /> Milestones Achieved</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {milestones.slice(0, 5).map((m, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span>{m.property} - {m.formattedValue}</span>
                  <span className="text-muted-foreground">{new Date(m.achievedAt).toLocaleDateString("en-AU")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
