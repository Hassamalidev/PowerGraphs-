import type { Unit } from "@/lib/datasets/catalog";
import { changeWords, formatApprox, formatValue } from "@/lib/format";
import { periodLabel } from "@/lib/period";
import { computeRelationship, correlationStrength, MIN_SHARED_POINTS } from "./relationship";
import { computeSummary } from "./summary";
import { computeTrend, fitStrength, type Trend } from "./trend";
import type { Pt } from "./types";

export type StatsMode = "summary" | "trend" | "relationship" | "none";

/** One dataset as the statistics see it. */
export type StatsSeries = {
  name: string; // full plain name, e.g. "New homes sold (yearly pace)"
  shortName: string; // e.g. "New homes sold"
  unit: Unit;
  visible: Pt[]; // points inside the selected range
  all: Pt[]; // the whole series in the current view
};

export const NOT_ENOUGH_FOR_TREND = "Not enough data in this range to show a trend. Try a longer range.";
export const NO_CAUSE = "This shows how they move together; it does not prove one causes the other.";

function rangeText(visible: Pt[]): string {
  return `${periodLabel(visible[0].date)} – ${periodLabel(visible[visible.length - 1].date)}`;
}

export function summarySentence(series: StatsSeries): string {
  const s = computeSummary(series.visible, series.all);
  if (!s) return `${series.name}: no data in this range.`;
  const fmt = (v: number) => formatValue(v, series.unit);

  const changes: string[] = [];
  if (s.fromPrevious?.percent != null) {
    changes.push(`${changeWords(s.fromPrevious.percent)} from ${periodLabel(s.fromPrevious.from.date)}`);
  }
  if (s.fromYearEarlier?.percent != null) {
    changes.push(`${changeWords(s.fromYearEarlier.percent)} from ${periodLabel(s.fromYearEarlier.from.date)}`);
  }

  let text = `${series.name}: ${fmt(s.latest.value)} in ${periodLabel(s.latest.date)}`;
  text += changes.length ? ` — ${changes.join(" and ")}.` : ".";

  if (series.visible.length > 1) {
    const over = s.overRange.percent != null ? ` (${changeWords(s.overRange.percent)})` : "";
    text += ` Over ${rangeText(series.visible)} it went from ${fmt(s.first.value)} to ${fmt(s.latest.value)}${over}.`;
    text += ` Highest: ${fmt(s.highest.value)} (${periodLabel(s.highest.date)}).`;
    text += ` Lowest: ${fmt(s.lowest.value)} (${periodLabel(s.lowest.date)}).`;
    text += ` Average: ${fmt(s.average)}.`;
  }
  return text;
}

export function trendSentence(series: StatsSeries, trend: Trend | null = computeTrend(series.visible)): string {
  if (!trend) return `${series.name}: ${NOT_ENOUGH_FOR_TREND}`;

  const amount = formatApprox(trend.slope, series.unit);
  const isFlat = /^\$?0(\.0+)?( months)?$/.test(amount);
  const direction = isFlat
    ? "has been roughly flat"
    : `has been ${trend.slope > 0 ? "rising" : "falling"} by about ${amount} per year`;

  const r2 = `R² = ${trend.r2.toFixed(2)}`;
  const strength = fitStrength(trend.r2);
  const fit =
    strength === "close"
      ? `The data follows the trend closely (${r2}).`
      : strength === "moderate"
        ? `The data follows the trend moderately (${r2}).`
        : `The data jumps around a lot, so the trend is weak (${r2}).`;

  return `${series.name} ${direction} over ${rangeText(series.visible)}. ${fit}`;
}

export function correlationText(r: number): string {
  // Use a real minus sign so it reads clearly: −0.52
  const text = Math.abs(r).toFixed(2);
  return r < 0 && text !== "0.00" ? `−${text}` : text;
}

export function pairSentence(y: StatsSeries, x: StatsSeries, withSlope: boolean): string {
  const rel = computeRelationship(y.visible, x.visible);
  if (!rel) {
    return `${y.shortName} and ${x.shortName}: not enough shared data in this range to compare them (at least ${MIN_SHARED_POINTS} points are needed). Try a longer range.`;
  }
  const strength = correlationStrength(rel.r);
  const direction = rel.r >= 0 ? "in the same direction" : "in opposite directions";
  let text = `${y.shortName} and ${x.shortName} have a ${strength} tendency to move ${direction} (correlation ${correlationText(rel.r)}).`;

  if (withSlope) {
    const effect = rel.slope * rel.xStep;
    const step = x.unit === "months" ? formatApprox(rel.xStep, x.unit) : formatValue(rel.xStep, x.unit);
    const amount = formatApprox(effect, y.unit);
    text += ` On average, when ${x.shortName} is ${step} higher, ${y.shortName} is about ${amount} ${effect >= 0 ? "higher" : "lower"}.`;
  }
  return text;
}

/** Sentences for "How two datasets move together": Dataset 1 against 2 (and 3, if present). */
export function relationshipSentences(series: StatsSeries[]): string {
  if (series.length < 2) return "Add a second dataset to see how two datasets move together.";
  const parts = [pairSentence(series[0], series[1], true)];
  if (series.length > 2) parts.push(pairSentence(series[0], series[2], false));
  parts.push(NO_CAUSE);
  return parts.join(" ");
}

/** The full auto-generated text for the top text box. */
export function buildStatsText(mode: StatsMode, series: StatsSeries[]): string {
  const withData = series.filter((s) => s.visible.length > 0);
  if (mode === "none" || withData.length === 0) return "";
  if (mode === "summary") return withData.map(summarySentence).join("\n\n");
  if (mode === "trend") return withData.map((s) => trendSentence(s)).join("\n\n");
  return relationshipSentences(withData);
}
