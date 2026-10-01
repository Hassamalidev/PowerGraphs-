import type { Unit } from "@/lib/datasets/catalog";

export type SeriesPoint = { date: string; label: string; value: number };

export type SeriesMeta = {
  unit: Unit;
  unitLabel: string;
  sourceLabel: string;
  dataAsOf: string;
  isFallback: boolean;
  fallbackDate?: string;
  incompleteQuarterNote?: string;
  /** Present in quarterly view when the values were computed, e.g. "Quarterly average of monthly values". */
  quarterlyMethod?: string;
};

export type SeriesResponse = { points: SeriesPoint[]; meta: SeriesMeta };
