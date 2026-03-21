"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface ReportContextValue {
  reportData: Record<string, unknown>[];
  setReportData: (data: Record<string, unknown>[]) => void;
}

const ReportContext = createContext<ReportContextValue | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [reportData, setReportData] = useState<Record<string, unknown>[]>([]);

  return (
    <ReportContext.Provider value={{ reportData, setReportData }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReportContext(): ReportContextValue {
  const ctx = useContext(ReportContext);
  if (!ctx) {
    throw new Error("useReportContext must be used within a ReportProvider");
  }
  return ctx;
}
