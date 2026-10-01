"use client";

import { useEffect, useState } from "react";
import { HeaderLink } from "@/components/layout/AppHeader";
import { api } from "@/lib/api";
import { chartCountText, lastReportId, REPORT_CHANGED_EVENT, type ReportSummaryDto } from "@/lib/reports/client";

/** Header link to the most recently used report: "Report (2 charts)". */
export function ReportHeaderLink() {
  const [report, setReport] = useState<{ id: string; count: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      const id = lastReportId();
      if (!id) return setReport(null);
      api<{ reports: ReportSummaryDto[] }>("/api/reports")
        .then((res) => {
          const found = res.reports.find((r) => r.id === id);
          if (!cancelled) setReport(found ? { id, count: found.chartCount } : null);
        })
        .catch(() => !cancelled && setReport(null)); // deleted or unreachable: just hide the link
    };
    refresh();
    window.addEventListener(REPORT_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(REPORT_CHANGED_EVENT, refresh);
    };
  }, []);

  if (!report) return null;
  return <HeaderLink href={`/reports/${report.id}`}>Report ({chartCountText(report.count)})</HeaderLink>;
}
