import type { Report, ReportItem, SavedChart } from "@prisma/client";
import { chartConfigSchema, type ChartConfig } from "@/lib/chart/config";
import { prisma } from "@/lib/db";

// Server-side helpers shared by the charts and reports API routes.

export type SavedChartDto = {
  id: string;
  title: string;
  config: ChartConfig | null; // null if the stored JSON can no longer be read
  topText: string;
  bottomText: string;
  imagePng: string; // base64, no "data:" prefix
  dataAsOf: string;
  updatedAt: string;
};

export type ReportDto = {
  id: string;
  title: string;
  meetingDate: string | null; // YYYY-MM-DD
  preparedBy: string;
  intro: string;
  updatedAt: string;
  items: { id: string; position: number; chart: SavedChartDto }[];
};

export type ReportSummaryDto = {
  id: string;
  title: string;
  meetingDate: string | null;
  chartCount: number;
  updatedAt: string;
};

export function toChartDto(chart: SavedChart): SavedChartDto {
  let config: ChartConfig | null = null;
  try {
    const parsed = chartConfigSchema.safeParse(JSON.parse(chart.config));
    if (parsed.success) config = parsed.data;
  } catch {
    // leave null
  }
  return {
    id: chart.id,
    title: chart.title,
    config,
    topText: chart.topText,
    bottomText: chart.bottomText,
    imagePng: chart.imagePng,
    dataAsOf: chart.dataAsOf.toISOString(),
    updatedAt: chart.updatedAt.toISOString(),
  };
}

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export function toReportDto(report: Report & { items: (ReportItem & { chart: SavedChart })[] }): ReportDto {
  return {
    id: report.id,
    title: report.title,
    meetingDate: dateOnly(report.meetingDate),
    preparedBy: report.preparedBy ?? "",
    intro: report.intro ?? "",
    updatedAt: report.updatedAt.toISOString(),
    items: [...report.items]
      .sort((a, b) => a.position - b.position)
      .map((item) => ({ id: item.id, position: item.position, chart: toChartDto(item.chart) })),
  };
}

export function toReportSummary(report: Report & { _count: { items: number } }): ReportSummaryDto {
  return {
    id: report.id,
    title: report.title,
    meetingDate: dateOnly(report.meetingDate),
    chartCount: report._count.items,
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function loadReport(id: string) {
  return prisma.report.findUnique({ where: { id }, include: { items: { include: { chart: true } } } });
}

/** Chart snapshots only exist inside reports; delete any that no report uses any more. */
export async function deleteOrphanCharts(chartIds: string[]) {
  if (chartIds.length === 0) return;
  await prisma.savedChart.deleteMany({ where: { id: { in: chartIds }, items: { none: {} } } });
}

/** Mark a report as just changed (adding, removing, or reordering charts). */
export function touchReport(id: string) {
  return prisma.report.update({ where: { id }, data: { updatedAt: new Date() } });
}

export const REPORT_NOT_FOUND = "We couldn't find that report. It may have been deleted.";
export const CHART_NOT_FOUND = "We couldn't find that chart. It may have been removed from the report.";
