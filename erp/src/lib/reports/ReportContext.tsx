"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

/**
 * `ready` means the page pushed exportable rows for the current report.
 * `error` means the report request failed: the layout hides Export/Save rather
 * than offering to export a blank shell (ARGUS #442).
 */
export type ReportStatus = "idle" | "loading" | "ready" | "error";

interface ReportContextValue {
  reportData: Record<string, unknown>[];
  setReportData: (data: Record<string, unknown>[]) => void;
  reportStatus: ReportStatus;
  setReportStatus: (status: ReportStatus) => void;
}

const ReportContext = createContext<ReportContextValue | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [reportData, setReportDataState] = useState<Record<string, unknown>[]>([]);
  const [reportStatus, setReportStatus] = useState<ReportStatus>("idle");

  const setReportData = useCallback((data: Record<string, unknown>[]) => {
    setReportDataState(data);
    setReportStatus(data.length > 0 ? "ready" : "idle");
  }, []);

  return (
    <ReportContext.Provider
      value={{ reportData, setReportData, reportStatus, setReportStatus }}
    >
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
