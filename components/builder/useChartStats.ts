"use client";

import { useMemo } from "react";
import type { ChartSeries, TrendLine } from "@/components/chart/chartModel";
import { buildStatsText, type StatsMode, type StatsSeries } from "@/lib/stats/sentences";
import { computeTrend } from "@/lib/stats/trend";
import type { Pt } from "@/lib/stats/types";

const NO_TRENDS: TrendLine[] = [];

type Input = {
  dates: string[];
  series: ChartSeries[];
  startIndex: number;
  endIndex: number;
  mode: StatsMode;
} | null;

/**
 * Statistics for the visible range and current view: the sentences for the
 * top text box and, in "Trend line" mode, the lines to draw.
 */
export function useChartStats(input: Input) {
  return useMemo(() => {
    if (!input) return { text: "", trends: NO_TRENDS };
    const { dates, series, startIndex, endIndex, mode } = input;

    const stats: StatsSeries[] = series.map((s) => {
      const all: Pt[] = [];
      const visible: Pt[] = [];
      s.values.forEach((value, i) => {
        if (value == null) return;
        const pt = { date: dates[i], value };
        all.push(pt);
        if (i >= startIndex && i <= endIndex) visible.push(pt);
      });
      return { name: s.name, shortName: s.shortName, unit: s.unit, visible, all };
    });

    let trends = NO_TRENDS;
    if (mode === "trend") {
      trends = series.flatMap((s, i) => {
        const trend = computeTrend(stats[i].visible);
        if (!trend) return [];
        const values: (number | null)[] = new Array(dates.length).fill(null);
        const indexOf = new Map(dates.map((d, k) => [d, k]));
        for (const p of trend.fitted) values[indexOf.get(p.date)!] = p.value;
        return [{ seriesId: s.id, values }];
      });
    }

    return { text: buildStatsText(mode, stats), trends };
  }, [input]);
}
