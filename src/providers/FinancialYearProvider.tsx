"use client";

import { createContext, useContext, useState, useEffect } from "react";
import {
  getCurrentFinancialYear,
  getFinancialYear,
  getAvailableFinancialYears,
  type FinancialYear,
} from "@/lib/financial-year";

interface FinancialYearContextValue {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  fy: FinancialYear;
  availableYears: FinancialYear[];
}

const FinancialYearContext = createContext<FinancialYearContextValue | null>(null);

const STORAGE_KEY = "bricktrack-fy";

export function FinancialYearProvider({ children }: { children: React.ReactNode }) {
  const [selectedYear, setSelectedYear] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed)) return parsed;
      }
    }
    return getCurrentFinancialYear();
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(selectedYear));
  }, [selectedYear]);

  const fy = getFinancialYear(selectedYear);
  const availableYears = getAvailableFinancialYears(3);

  return (
    <FinancialYearContext.Provider value={{ selectedYear, setSelectedYear, fy, availableYears }}>
      {children}
    </FinancialYearContext.Provider>
  );
}

export function useFinancialYear() {
  const ctx = useContext(FinancialYearContext);
  if (!ctx) {
    throw new Error("useFinancialYear must be used within FinancialYearProvider");
  }
  return ctx;
}
