import { api } from "@/lib/api";
import type { ChartConfig } from "@/lib/chart/config";
import { getDataset } from "@/lib/datasets/catalog";
import { formatShortDate } from "@/lib/format";
import type { ChartPage } from "@/lib/pdf/chartPdf";
import type { ReportDto, ReportSummaryDto, SavedChartDto } from "./server";

export type { ReportDto, ReportSummaryDto, SavedChartDto };

const PNG_PREFIX = "data:image/png;base64,";
const LAST_REPORT_KEY = "powergraphs:lastReport";
/** Fired on `window` whenever a report gains or loses charts, so the header link can update. */
export const REPORT_CHANGED_EVENT = "powergraphs:report-changed";

export function defaultReportTitle(date = new Date()): string {
  return `Management meeting report – ${formatShortDate(date)}`;
}

export function chartCountText(n: number): string {
  return n === 1 ? "1 chart" : `${n} charts`;
}

/** The body for POST/PUT /api/charts: a full snapshot of the chart as it looks now. */
export function snapshotBody(page: ChartPage, config: ChartConfig, dataAsOf: string) {
  return {
    title: page.title,
    config,
    topText: page.topText,
    bottomText: page.bottomText,
    imagePng: page.image.startsWith(PNG_PREFIX) ? page.image.slice(PNG_PREFIX.length) : page.image,
    dataAsOf,
  };
}

/** Turn a saved snapshot back into a printable page. */
export function savedChartToPage(chart: SavedChartDto): ChartPage {
  const source = getDataset(chart.config?.datasets[0] ?? "")?.sourceLabel ?? "U.S. Census Bureau";
  return {
    title: chart.title,
    topText: chart.topText,
    bottomText: chart.bottomText,
    image: PNG_PREFIX + chart.imagePng,
    sourceLine: `Source: ${source}. Data as of ${formatShortDate(chart.dataAsOf.slice(0, 10))}.`,
  };
}

export function rememberReport(id: string) {
  try {
    window.localStorage.setItem(LAST_REPORT_KEY, id);
  } catch {
    // storage blocked — the header link just won't appear
  }
  window.dispatchEvent(new Event(REPORT_CHANGED_EVENT));
}

export function forgetReport(id: string) {
  try {
    if (window.localStorage.getItem(LAST_REPORT_KEY) === id) window.localStorage.removeItem(LAST_REPORT_KEY);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(REPORT_CHANGED_EVENT));
}

export function lastReportId(): string | null {
  try {
    return window.localStorage.getItem(LAST_REPORT_KEY);
  } catch {
    return null;
  }
}

/** Save a chart snapshot and add it to a report (creating the report first if needed). */
export async function addChartToReport(
  target: { reportId: string } | { newTitle: string },
  page: ChartPage,
  config: ChartConfig,
  dataAsOf: string,
): Promise<{ reportId: string; title: string; chartCount: number }> {
  let reportId: string;
  if ("reportId" in target) reportId = target.reportId;
  else reportId = (await api<{ report: ReportSummaryDto }>("/api/reports", { method: "POST", body: { title: target.newTitle } })).report.id;

  const { chart } = await api<{ chart: SavedChartDto }>("/api/charts", { method: "POST", body: snapshotBody(page, config, dataAsOf) });
  const added = await api<{ chartCount: number; title: string }>(`/api/reports/${reportId}/items`, {
    method: "POST",
    body: { chartId: chart.id },
  });
  rememberReport(reportId);
  return { reportId, title: added.title, chartCount: added.chartCount };
}
