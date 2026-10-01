import { shiftPeriod, yearEarlier } from "@/lib/period";
import type { Pt } from "./types";

export type Change = { from: Pt; absolute: number; percent: number | null };

export type Summary = {
  latest: Pt;
  first: Pt;
  /** Change from the period just before the latest one. */
  fromPrevious: Change | null;
  /** Change from the same period one year earlier (may be outside the visible range). */
  fromYearEarlier: Change | null;
  /** Change from the first visible point to the last. */
  overRange: Change;
  highest: Pt;
  lowest: Pt;
  average: number;
};

function change(from: Pt, to: Pt): Change {
  return {
    from,
    absolute: to.value - from.value,
    percent: from.value === 0 ? null : ((to.value - from.value) / Math.abs(from.value)) * 100,
  };
}

/**
 * Plain summary of the visible range.
 * @param visible points inside the selected range, ascending
 * @param all the whole series in the current view (used to look back one period / one year)
 */
export function computeSummary(visible: Pt[], all: Pt[]): Summary | null {
  if (visible.length === 0) return null;
  const latest = visible[visible.length - 1];
  const first = visible[0];
  const byDate = new Map(all.map((p) => [p.date, p]));

  const previous = byDate.get(shiftPeriod(latest.date, -1));
  const yearAgo = byDate.get(yearEarlier(latest.date));

  let highest = first;
  let lowest = first;
  let sum = 0;
  for (const p of visible) {
    if (p.value > highest.value) highest = p;
    if (p.value < lowest.value) lowest = p;
    sum += p.value;
  }

  return {
    latest,
    first,
    fromPrevious: previous ? change(previous, latest) : null,
    fromYearEarlier: yearAgo ? change(yearAgo, latest) : null,
    overRange: change(first, latest),
    highest,
    lowest,
    average: sum / visible.length,
  };
}
