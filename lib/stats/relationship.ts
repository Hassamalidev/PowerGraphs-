import { linearRegression, sampleCorrelation, sampleStandardDeviation } from "simple-statistics";
import type { Pt } from "./types";

export const MIN_SHARED_POINTS = 8;

export type Relationship = {
  /** Pearson correlation, −1 to 1. */
  r: number;
  /** Simple regression Y = intercept + slope × X. */
  slope: number;
  intercept: number;
  /** Number of dates where both datasets have a value. */
  n: number;
  /** A round step in X's units, used to explain the slope in plain words. */
  xStep: number;
};

/** Pair up two series by date; only dates where both have values are kept. */
export function alignByDate(y: Pt[], x: Pt[]): { date: string; y: number; x: number }[] {
  const xByDate = new Map(x.map((p) => [p.date, p.value]));
  const out: { date: string; y: number; x: number }[] = [];
  for (const p of y) {
    const xv = xByDate.get(p.date);
    if (xv !== undefined) out.push({ date: p.date, y: p.value, x: xv });
  }
  return out;
}

/** Nearest "nice" number (1, 2, 5 × a power of ten) at or below the value. */
export function niceStep(value: number): number {
  if (!(value > 0)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / power;
  const nice = scaled >= 5 ? 5 : scaled >= 2 ? 2 : 1;
  return nice * power;
}

/**
 * Correlation and simple regression of Y on X over their shared dates.
 * Returns null with fewer than 8 shared points or when either series never changes.
 */
export function computeRelationship(y: Pt[], x: Pt[]): Relationship | null {
  const pairs = alignByDate(y, x);
  if (pairs.length < MIN_SHARED_POINTS) return null;
  const xs = pairs.map((p) => p.x);
  const ys = pairs.map((p) => p.y);
  const sdX = sampleStandardDeviation(xs);
  const sdY = sampleStandardDeviation(ys);
  if (sdX === 0 || sdY === 0) return null;

  const r = sampleCorrelation(xs, ys);
  const { m, b } = linearRegression(pairs.map((p) => [p.x, p.y]));
  if (![r, m, b].every(Number.isFinite)) return null;

  return { r: Math.max(-1, Math.min(1, r)), slope: m, intercept: b, n: pairs.length, xStep: niceStep(sdX) };
}

export type Strength = "strong" | "moderate" | "weak";

export function correlationStrength(r: number): Strength {
  const shown = Math.round(Math.abs(r) * 100) / 100;
  if (shown >= 0.7) return "strong";
  if (shown >= 0.4) return "moderate";
  return "weak";
}
