"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MenuIcon,
  DownloadIcon,
  BookmarkIcon,
  FolderOpenIcon,
  FileTextIcon,
  FileSpreadsheetIcon,
  FileIcon,
  Trash2Icon,
} from "lucide-react";
import DateRangePicker from "@/components/reports/DateRangePicker";
import { ReportProvider, useReportContext } from "@/lib/reports/ReportContext";
import {
  exportToCSV,
  exportToExcel,
  exportToPDF,
  type ReportColumn,
  type ReportRow,
} from "@/lib/reports/export";

// ── Date helper ─────────────────────────────────────────────────

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return toYMD(d);
}

function defaultTo(): string {
  return toYMD(new Date());
}

// ── Nav items ───────────────────────────────────────────────────

interface NavItem {
  label: string;
  href: string;
}

function getNavItems(): NavItem[] {
  return [
    { label: "Profit & Loss", href: "/reports/profit-loss" },
    { label: "Sales by Product", href: "/reports/sales" },
    { label: "Revenue Trend", href: "/reports/revenue-trend" },
    { label: "Inventory Valuation", href: "/reports/inventory-valuation" },
    { label: "Stock Movements", href: "/reports/stock-movements" },
    { label: "Customer Analytics", href: "/reports/customer-analytics" },
    { label: "Staff Performance", href: "/reports/staff-performance" },
    { label: "Return Rate", href: "/reports/return-rate" },
    { label: "Saved Reports", href: "/reports/saved" },
  ];
}

// ── Save Report schema ──────────────────────────────────────────

const saveReportSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

type SaveReportForm = z.infer<typeof saveReportSchema>;

interface SavedReportRecord {
  id: string;
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

// ── Component ───────────────────────────────────────────────────

interface ReportLayoutProps {
  children: React.ReactNode;
  reportType?: string | undefined;
  reportColumns?: ReportColumn[] | undefined;
  reportTitle?: string | undefined;
}

export default function ReportLayout({
  children,
  reportType,
  reportColumns,
  reportTitle,
}: ReportLayoutProps) {
  return (
    <ReportProvider>
      <ReportLayoutInner
        reportType={reportType}
        reportColumns={reportColumns}
        reportTitle={reportTitle}
      >
        {children}
      </ReportLayoutInner>
    </ReportProvider>
  );
}

function ReportLayoutInner({
  children,
  reportType,
  reportColumns,
  reportTitle,
}: ReportLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { reportData } = useReportContext();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savedReportsOpen, setSavedReportsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [savedReports, setSavedReports] = useState<SavedReportRecord[]>([]);
  const [savedReportsLoading, setSavedReportsLoading] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const from = searchParams.get("from") || defaultFrom();
  const to = searchParams.get("to") || defaultTo();

  const navItems = getNavItems();
  const currentReportTitle =
    reportTitle ?? navItems.find((item) => item.href === pathname)?.label ?? "Report";

  // ── Date range handler ──────────────────────────────────────

  function handleRangeChange(range: { from: string; to: string }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", range.from);
    params.set("to", range.to);
    router.push(`${pathname}?${params.toString()}`);
  }

  // ── Export handlers ─────────────────────────────────────────

  async function handleExport(format: "pdf" | "csv" | "excel") {
    if (isExporting || !reportColumns || reportColumns.length === 0) {
      setExportOpen(false);
      return;
    }

    const rows = reportData as ReportRow[];
    if (rows.length === 0) {
      toast.error("No data to export");
      setExportOpen(false);
      return;
    }

    setIsExporting(true);
    setExportOpen(false);

    const title = reportTitle ?? reportType ?? "Report";
    const dateRange = `${from} to ${to}`;
    const safeName = title.replace(/\s+/g, "_");

    try {
      switch (format) {
        case "csv":
          await exportToCSV(rows, reportColumns, safeName);
          break;
        case "excel":
          await exportToExcel(rows, reportColumns, title, safeName);
          break;
        case "pdf":
          await exportToPDF(title, dateRange, rows, reportColumns, safeName);
          break;
      }
      toast.success(`${format.toUpperCase()} export started`);
    } catch {
      toast.error(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setIsExporting(false);
    }
  }

  // ── Save report ─────────────────────────────────────────────

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SaveReportForm>({
    resolver: standardSchemaResolver(saveReportSchema),
    defaultValues: { name: "" },
  });

  async function onSave(data: SaveReportForm) {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      filters[key] = value;
    });

    try {
      const res = await fetch("/api/reports/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          reportType: pathname,
          filters,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success("Report saved");
        reset();
        setSaveDialogOpen(false);
      } else {
        toast.error(json.error?.message ?? "Failed to save report");
      }
    } catch {
      toast.error("Failed to save report");
    }
  }

  async function loadSavedReports() {
    setSavedReportsLoading(true);
    try {
      const res = await fetch("/api/reports/saved");
      const json = (await res.json()) as {
        success: boolean;
        data?: SavedReportRecord[];
        error?: { message?: string };
      };

      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? "Failed to load saved reports");
        return;
      }

      setSavedReports(json.data ?? []);
    } catch {
      toast.error("Failed to load saved reports");
    } finally {
      setSavedReportsLoading(false);
    }
  }

  function buildSavedReportHref(savedReport: SavedReportRecord): string {
    const route = savedReport.reportType.startsWith("/") ? savedReport.reportType : pathname;
    const params = new URLSearchParams();

    Object.entries(savedReport.filters ?? {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        params.set(key, value);
      } else if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string") {
            params.append(key, item);
          }
        });
      }
    });

    const query = params.toString();
    return query ? `${route}?${query}` : route;
  }

  async function handleDeleteSavedReport(reportId: string) {
    setDeletingReportId(reportId);
    try {
      const res = await fetch(`/api/reports/saved/${reportId}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as
        | { success?: boolean; error?: { message?: string } }
        | null;

      if (!res.ok || !json?.success) {
        toast.error(json?.error?.message ?? "Failed to delete saved report");
        return;
      }

      toast.success("Saved report deleted");
      setSavedReports((current) => current.filter((report) => report.id !== reportId));
    } catch {
      toast.error("Failed to delete saved report");
    } finally {
      setDeletingReportId(null);
    }
  }

  function handleSavedReportsOpenChange(open: boolean) {
    setSavedReportsOpen(open);
    if (open) {
      void loadSavedReports();
    }
  }

  // ── Sidebar content (shared between desktop & mobile) ───────

  function SidebarNav({ onItemClick }: { onItemClick?: () => void }) {
    return (
      <nav className="flex flex-col gap-0.5 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              {...(onItemClick ? { onClick: onItemClick } : {})}
              className={`block px-4 py-2 font-body text-sm transition-colors ${
                isActive
                  ? "border-l-3 border-terracotta font-semibold text-espresso"
                  : "border-l-3 border-transparent text-espresso/70 hover:bg-linen hover:text-espresso"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
      <div className="flex h-full min-h-0 flex-col">
        {/* ── Header strip ─────────────────────────────────────── */}
        <header className="flex items-center gap-3 border-b border-mist bg-linen px-4 py-3">
          {/* Mobile menu trigger */}
          <div className="md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open report navigation">
                  <MenuIcon className="h-5 w-5 text-espresso" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 bg-pearl p-0">
                <SheetTitle className="px-4 pt-4 font-display text-lg font-bold text-espresso">
                  Reports
                </SheetTitle>
                <SidebarNav onItemClick={() => setMobileNavOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>

          <h1 className="font-display text-lg font-bold text-espresso md:hidden">
            Reports
          </h1>

          <div className="flex flex-1 items-center gap-2 md:gap-3">
            <DateRangePicker
              from={from}
              to={to}
              onRangeChange={handleRangeChange}
            />

            <div className="ml-auto flex items-center gap-2">
              {/* Export popover */}
              <Popover open={exportOpen} onOpenChange={setExportOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isExporting}
                    className="gap-1.5 border-mist bg-white font-body text-sm text-espresso"
                  >
                    <DownloadIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">{isExporting ? "Exporting…" : "Export"}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1">
                  <button
                    type="button"
                    onClick={() => handleExport("pdf")}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                  >
                    <FileTextIcon className="h-4 w-4 text-terracotta" />
                    Export as PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("csv")}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                  >
                    <FileIcon className="h-4 w-4 text-terracotta" />
                    Export as CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("excel")}
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 font-body text-sm text-espresso hover:bg-linen transition-colors"
                  >
                    <FileSpreadsheetIcon className="h-4 w-4 text-terracotta" />
                    Export as Excel
                  </button>
                </PopoverContent>
              </Popover>

              {/* Save report dialog */}
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-mist bg-white font-body text-sm text-espresso"
                  >
                    <BookmarkIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Save Report</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display text-espresso">
                      Save Report
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit(onSave)}>
                    <div className="py-4">
                      <Label htmlFor="report-name" className="font-body text-sm text-espresso">
                        Report Name
                      </Label>
                      <Input
                        id="report-name"
                        placeholder="e.g. Monthly Sales Summary"
                        className="mt-1.5"
                        {...register("name")}
                      />
                      {errors.name && (
                        <p className="mt-1 font-body text-xs text-danger">
                          {errors.name.message}
                        </p>
                      )}
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting} size="sm">
                        {isSubmitting ? "Saving…" : "Save"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <Dialog open={savedReportsOpen} onOpenChange={handleSavedReportsOpenChange}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-mist bg-white font-body text-sm text-espresso"
                  >
                    <FolderOpenIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Saved Reports</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle className="font-display text-espresso">
                      Saved Reports
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3">
                    <p className="text-sm text-mist">
                      Open or remove previously saved report filters.
                    </p>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/reports/saved" onClick={() => setSavedReportsOpen(false)}>
                          Manage all saved reports
                        </Link>
                      </Button>
                    </div>

                    {savedReportsLoading ? (
                      <div className="space-y-2">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-16 animate-pulse rounded-md border border-mist bg-linen"
                          />
                        ))}
                      </div>
                    ) : savedReports.length === 0 ? (
                      <div className="rounded-md border border-dashed border-mist bg-linen px-4 py-6 text-center text-sm text-mist">
                        No saved reports yet for {currentReportTitle}.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedReports.map((savedReport) => {
                          const isDeleting = deletingReportId === savedReport.id;

                          return (
                            <div
                              key={savedReport.id}
                              className="flex items-start justify-between gap-3 rounded-md border border-mist bg-pearl px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium text-espresso">
                                  {savedReport.name}
                                </p>
                                <p className="text-xs text-mist">
                                  {new Date(savedReport.createdAt).toLocaleString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSavedReportsOpen(false);
                                    router.push(buildSavedReportHref(savedReport));
                                  }}
                                >
                                  Open
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-terracotta hover:text-terracotta"
                                  disabled={isDeleting}
                                  onClick={() => {
                                    void handleDeleteSavedReport(savedReport.id);
                                  }}
                                >
                                  <Trash2Icon className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex md:w-56 md:flex-col md:border-r md:border-mist md:bg-pearl">
            <div className="px-4 pt-4 pb-2">
              <h2 className="font-display text-lg font-bold text-espresso">
                Reports
              </h2>
            </div>
            <SidebarNav />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto bg-white p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
  );
}
