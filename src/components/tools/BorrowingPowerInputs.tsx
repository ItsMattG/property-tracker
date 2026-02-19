"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  getHemBenchmark,
  type HouseholdType,
  type BorrowingPowerInputs as CalcInputs,
} from "@/lib/borrowing-power-calc";

// ---------------------------------------------------------------------------
// NumberInput — reusable numeric field with optional prefix/suffix/hints
// ---------------------------------------------------------------------------

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  hint?: string;
  preFilledLabel?: boolean;
  className?: string;
}

function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
  preFilledLabel,
  className,
}: NumberInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = e.target.value.replace(/[^0-9.]/g, "");
    const parsed = parseFloat(cleaned);
    onChange(Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium leading-none">{label}</label>
        {preFilledLabel && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
            from portfolio
          </span>
        )}
      </div>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          type="text"
          inputMode="numeric"
          value={value === 0 ? "" : String(value)}
          onChange={handleChange}
          className={cn("tabular-nums", prefix && "pl-7", suffix && "pr-14")}
          placeholder="0"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section — collapsible card section with chevron toggle
// ---------------------------------------------------------------------------

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{title}</CardTitle>
          {open ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      {open && <CardContent className="space-y-4">{children}</CardContent>}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// BorrowingPowerInputPanel — main export
// ---------------------------------------------------------------------------

interface BorrowingPowerInputPanelProps {
  inputs: CalcInputs;
  onChange: (updates: Partial<CalcInputs>) => void;
  preFilledFields: Set<string>;
}

export function BorrowingPowerInputPanel({
  inputs,
  onChange,
  preFilledFields,
}: BorrowingPowerInputPanelProps) {
  const hemBenchmark = getHemBenchmark(inputs.householdType, inputs.dependants);
  const hemApplied = inputs.livingExpenses < hemBenchmark;
  const creditCardCommitment = Math.round(inputs.creditCardLimits * 0.038);

  return (
    <div className="space-y-3">
      {/* ---- Income ---- */}
      <Section title="Income">
        <NumberInput
          label="Gross monthly salary"
          value={inputs.grossSalary}
          onChange={(v) => onChange({ grossSalary: v })}
          prefix="$"
          hint="100% shading applied"
        />
        <NumberInput
          label="Monthly rental income"
          value={inputs.rentalIncome}
          onChange={(v) => onChange({ rentalIncome: v })}
          prefix="$"
          hint="80% shading applied by banks"
          preFilledLabel={preFilledFields.has("rentalIncome")}
        />
        <NumberInput
          label="Other monthly income"
          value={inputs.otherIncome}
          onChange={(v) => onChange({ otherIncome: v })}
          prefix="$"
          hint="80% shading applied by banks"
        />
      </Section>

      {/* ---- Household ---- */}
      <Section title="Household">
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">Status</label>
          <Select
            value={inputs.householdType}
            onValueChange={(v) =>
              onChange({ householdType: v as HouseholdType })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="couple">Couple</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium leading-none">
            Dependants
          </label>
          <Select
            value={String(inputs.dependants)}
            onValueChange={(v) => onChange({ dependants: parseInt(v, 10) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 7 }, (_, i) => (
                <SelectItem key={i} value={String(i)}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      {/* ---- Living Expenses ---- */}
      <Section title="Living Expenses">
        <NumberInput
          label="Monthly living expenses"
          value={inputs.livingExpenses}
          onChange={(v) => onChange({ livingExpenses: v })}
          prefix="$"
        />
        <div
          className={cn(
            "rounded-md px-3 py-2 text-xs",
            hemApplied
              ? "bg-warning/10 text-warning"
              : "bg-muted text-muted-foreground"
          )}
        >
          {hemApplied ? (
            <>
              HEM benchmark for your household is{" "}
              <span className="font-semibold">
                {formatCurrency(hemBenchmark)}/mo
              </span>
              . Banks will use HEM (higher) for assessment.
            </>
          ) : (
            <>
              HEM benchmark:{" "}
              <span className="font-semibold">
                {formatCurrency(hemBenchmark)}/mo
              </span>
              . Your declared expenses will be used.
            </>
          )}
        </div>
      </Section>

      {/* ---- Existing Commitments ---- */}
      <Section title="Existing Commitments">
        <NumberInput
          label="Property loan repayments"
          value={inputs.existingPropertyLoans}
          onChange={(v) => onChange({ existingPropertyLoans: v })}
          prefix="$"
          suffix="/mo"
          preFilledLabel={preFilledFields.has("existingPropertyLoans")}
        />
        <NumberInput
          label="Credit card limits"
          value={inputs.creditCardLimits}
          onChange={(v) => onChange({ creditCardLimits: v })}
          prefix="$"
          hint={`Banks assume 3.8% commitment = ${formatCurrency(creditCardCommitment)}/mo`}
        />
        <NumberInput
          label="Other loan repayments"
          value={inputs.otherLoans}
          onChange={(v) => onChange({ otherLoans: v })}
          prefix="$"
          suffix="/mo"
        />
        <NumberInput
          label="HECS/HELP balance"
          value={inputs.hecsBalance}
          onChange={(v) => onChange({ hecsBalance: v })}
          prefix="$"
        />
      </Section>

      {/* ---- Loan Settings ---- */}
      <Section title="Loan Settings" defaultOpen={false}>
        <NumberInput
          label="Target interest rate"
          value={inputs.targetRate}
          onChange={(v) => onChange({ targetRate: v })}
          suffix="%"
        />
        <NumberInput
          label="Loan term"
          value={inputs.loanTermYears}
          onChange={(v) => onChange({ loanTermYears: v })}
          suffix="years"
        />
        <NumberInput
          label="Floor rate"
          value={inputs.floorRate}
          onChange={(v) => onChange({ floorRate: v })}
          suffix="%"
          hint="APRA adds 3% buffer to whichever is higher"
        />
      </Section>
    </div>
  );
}
