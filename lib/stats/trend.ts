import { linearRegression, rSquared } from "simple-statistics";
import { isQuarter } from "@/lib/period";
import type { Pt } from "./types";

export const MIN_TREND_POINTS = 6;

export type Trend = {
  /** Change per year. */
  slope: number;
  /** Fitted value at the first visible point. */
  intercept: number;
  /** 0–1: how closely the data follows the line. */
  r2: number;
  /** The line's value at each visible point, in the same order. */
  fitted: Pt[];
};

/** Periods between two dates of the same kind (months or quarters). */
function periodsBetween(a: string, b: string): number {
  const size = isQuarter(a) ? 4 : 12;
  const index = (p: string) => {
    const [y, rest] = p.split("-");
    return Number(y) * size + Number(rest.replace("Q", "")) - 1;
  };
  return index(b) - index(a);
}

/**
 * Ordinary least squares fit of value = a + b × t, where t is time in years
 * from the first visible point. Returns null when there are fewer than 6 points.
 */
export function computeTrend(visible: Pt[]): Trend | null {
  if (visible.length < MIN_TREND_POINTS) return null;
  const perYear = isQuarter(visible[0].date) ? 4 : 12;
  const data = visible.map((p) => [periodsBetween(visible[0].date, p.date) / perYear, p.value]);
  const { m, b } = linearRegression(data);
  if (!Number.isFinite(m) || !Number.isFinite(b)) return null;

  const line = (t: number) => b + m * t;
  const allSame = visible.every((p) => p.value === visible[0].value);
  // A perfectly flat series has no variation to explain; call that a perfect fit.
  const r2 = allSame ? 1 : rSquared(data, line);

  return {
    slope: m,
    intercept: b,
    r2: Number.isFinite(r2) ? Math.max(0, Math.min(1, r2)) : 0,
    fitted: visible.map((p, i) => ({ date: p.date, value: line(data[i][0]) })),
  };
}

export type FitStrength = "close" | "moderate" | "weak";

export function fitStrength(r2: number): FitStrength {
  // Compare what the user sees (2 decimals) so "R² = 0.70" always reads as close.
  const shown = Math.round(r2 * 100) / 100;
  if (shown >= 0.7) return "close";
  if (shown >= 0.4) return "moderate";
  return "weak";
}
