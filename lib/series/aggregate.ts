import type { MonthlyPoint } from "@/lib/census/parse";
import { monthToQuarter, periodLabel, quarterMonths } from "@/lib/period";

export type AggregateRule = "average" | "sum" | "last";

export type QuarterlyResult = {
  points: MonthlyPoint[]; // date is "YYYY-Qn"
  /** Set when the newest quarter is left out because it isn't complete yet. */
  incompleteQuarterNote?: string;
};

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Turn monthly points into quarterly ones. Only complete quarters (all 3
 * months present) are kept.
 */
export function toQuarterly(monthly: MonthlyPoint[], rule: AggregateRule): QuarterlyResult {
  const byQuarter = new Map<string, Map<string, number>>();
  for (const p of monthly) {
    const q = monthToQuarter(p.date);
    if (!byQuarter.has(q)) byQuarter.set(q, new Map());
    byQuarter.get(q)!.set(p.date, p.value);
  }

  const points: MonthlyPoint[] = [];
  const quarters = [...byQuarter.keys()].sort();
  let incompleteQuarterNote: string | undefined;

  for (const q of quarters) {
    const months = byQuarter.get(q)!;
    const values = quarterMonths(q).map((m) => months.get(m));
    if (values.some((v) => v === undefined)) {
      if (q === quarters[quarters.length - 1]) {
        incompleteQuarterNote = `${periodLabel(q)} not shown yet — only ${months.size} of 3 months ${
          months.size === 1 ? "is" : "are"
        } available.`;
      }
      continue;
    }
    const [a, b, c] = values as number[];
    const value = rule === "sum" ? a + b + c : rule === "last" ? c : (a + b + c) / 3;
    points.push({ date: q, value: round(value) });
  }

  return { points, incompleteQuarterNote };
}

/** Tooltip wording for values the app computed itself. */
export function quarterlyMethodText(rule: AggregateRule): string {
  if (rule === "sum") return "Quarterly sum of monthly values";
  if (rule === "last") return "End of quarter value";
  return "Quarterly average of monthly values";
}
