"use client";

import { useMemo } from "react";
import type { ChartSeries } from "@/components/chart/chartModel";
import { resolveRange, type BuilderState } from "@/lib/chart/state";
import { getDataset, type PublicDataset } from "@/lib/datasets/catalog";
import { periodLabel } from "@/lib/period";
import type { SeriesResponse } from "@/lib/series/types";
import { SERIES_STYLES } from "@/lib/theme";
import { useSeriesData } from "./useSeriesData";

/** Loads the selected datasets and shapes them for the chart and the statistics. */
export function useChartData(state: BuilderState) {
  const { series: responses, error, retry } = useSeriesData(state.datasets, state.view);

  const data = useMemo(() => {
    if (!responses) return null;
    const defs = state.datasets.map((id) => getDataset(id)).filter(Boolean) as PublicDataset[];
    if (defs.length !== responses.length) return null;

    // One shared date axis: every date any selected dataset has.
    const dates = [...new Set(responses.flatMap((r) => r.points.map((p) => p.date)))].sort();
    const labels = dates.map(periodLabel);
    const indexOf = new Map(dates.map((d, i) => [d, i]));

    const series: ChartSeries[] = defs.map((def, slot) => {
      const values: (number | null)[] = new Array(dates.length).fill(null);
      for (const p of responses[slot].points) values[indexOf.get(p.date)!] = p.value;
      return {
        id: def.id,
        name: def.name,
        shortName: def.shortName,
        unit: def.unit,
        unitLabel: def.unitLabel,
        ...SERIES_STYLES[slot],
        values,
        quarterlyMethod: responses[slot].meta.quarterlyMethod,
      };
    });

    return { defs, responses: responses as SeriesResponse[], dates, labels, series };
  }, [responses, state.datasets]);

  const resolved = useMemo(() => (data ? resolveRange(state.range, data.dates) : null), [data, state.range]);

  return { data, resolved, error, retry };
}
