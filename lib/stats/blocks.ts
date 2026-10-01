import { formatApprox, formatPercent, formatValue, formatValueWithUnit } from "@/lib/format";
import { periodLabel } from "@/lib/period";
import { computeRelationship, correlationStrength } from "./relationship";
import { correlationText, NO_CAUSE, NOT_ENOUGH_FOR_TREND, pairSentence, type StatsMode, type StatsSeries } from "./sentences";
import { computeSummary, type Change } from "./summary";
import { computeTrend, fitStrength } from "./trend";

// The same statistics as the sentences in sentences.ts, shaped for display as
// cards on screen. (Print, PDF, and email use the sentences.)

export type Tone = "up" | "down" | "flat" | "neutral";

export type StatBlock = {
  /** Which dataset slot this card belongs to (for its colour); undefined for cards about two datasets. */
  slot?: number;
  title: string;
  /** The big number or phrase. */
  headline: string;
  headlineNote?: string;
  chips: { text: string; tone: Tone }[];
  facts: { label: string; value: string }[];
  /** A plain sentence shown under the card's numbers. */
  sentence?: string;
};

export type StatBlocks = { blocks: StatBlock[]; footnote?: string };

function tone(percent: number): Tone {
  const shown = Math.abs(percent).toFixed(1);
  if (shown === "0.0") return "flat";
  return percent > 0 ? "up" : "down";
}

function changeChip(change: Change | null): StatBlock["chips"] {
  if (!change || change.percent == null) return [];
  const t = tone(change.percent);
  const from = periodLabel(change.from.date);
  const text = t === "flat" ? `Unchanged from ${from}` : `${t === "up" ? "Up" : "Down"} ${formatPercent(change.percent)} from ${from}`;
  return [{ text, tone: t }];
}

function summaryBlock(series: StatsSeries, slot: number): StatBlock {
  const s = computeSummary(series.visible, series.all);
  if (!s) return { slot, title: series.name, headline: "No data in this range", chips: [], facts: [] };
  const fmt = (v: number) => formatValue(v, series.unit);
  const facts: StatBlock["facts"] = [];
  if (series.visible.length > 1) {
    const over = s.overRange.percent;
    const overText = over == null ? "" : tone(over) === "flat" ? " (unchanged)" : ` (${over > 0 ? "up" : "down"} ${formatPercent(over)})`;
    facts.push(
      { label: `Since ${periodLabel(s.first.date)}`, value: `${fmt(s.first.value)} → ${fmt(s.latest.value)}${overText}` },
      { label: "Highest", value: `${fmt(s.highest.value)} (${periodLabel(s.highest.date)})` },
      { label: "Lowest", value: `${fmt(s.lowest.value)} (${periodLabel(s.lowest.date)})` },
      { label: "Average", value: fmt(s.average) },
    );
  }
  return {
    slot,
    title: series.name,
    headline: formatValueWithUnit(s.latest.value, series.unit),
    headlineNote: `in ${periodLabel(s.latest.date)}`,
    chips: [...changeChip(s.fromPrevious), ...changeChip(s.fromYearEarlier)],
    facts,
  };
}

function trendBlock(series: StatsSeries, slot: number): StatBlock {
  const trend = computeTrend(series.visible);
  if (!trend) return { slot, title: series.name, headline: "Not enough data", chips: [], facts: [], sentence: NOT_ENOUGH_FOR_TREND };
  const amount = formatApprox(trend.slope, series.unit);
  const isFlat = /^\$?0(\.0+)?( months)?$/.test(amount);
  const strength = fitStrength(trend.r2);
  const range = `${periodLabel(series.visible[0].date)} – ${periodLabel(series.visible[series.visible.length - 1].date)}`;
  return {
    slot,
    title: series.name,
    headline: isFlat ? "Roughly flat" : `${trend.slope > 0 ? "Rising" : "Falling"} about ${amount} per year`,
    headlineNote: `over ${range}`,
    chips: [
      {
        text: strength === "close" ? "Follows the trend closely" : strength === "moderate" ? "Follows the trend moderately" : "Jumps around a lot — weak trend",
        tone: isFlat ? "flat" : trend.slope > 0 ? "up" : "down",
      },
    ],
    facts: [{ label: "How well the line fits (R²)", value: `${trend.r2.toFixed(2)} out of 1` }],
  };
}

function pairBlock(y: StatsSeries, x: StatsSeries, withSlope: boolean): StatBlock {
  const rel = computeRelationship(y.visible, x.visible);
  const title = `${y.shortName} and ${x.shortName}`;
  if (!rel) return { title, headline: "Not enough shared data", chips: [], facts: [], sentence: pairSentence(y, x, withSlope) };
  const strength = correlationStrength(rel.r);
  const same = rel.r >= 0;
  return {
    title,
    headline: `${strength[0].toUpperCase()}${strength.slice(1)} tendency to move ${same ? "in the same direction" : "in opposite directions"}`,
    chips: [{ text: `Correlation ${correlationText(rel.r)}`, tone: "neutral" }],
    facts: [{ label: "Months or quarters compared", value: String(rel.n) }],
    sentence: withSlope ? pairSentence(y, x, true).split(/(?<=\)\.) /)[1] : undefined,
  };
}

/** The statistics as cards. Returns no blocks when statistics are hidden. */
export function buildStatBlocks(mode: StatsMode, series: StatsSeries[]): StatBlocks {
  const withData = series.map((s, slot) => ({ s, slot })).filter(({ s }) => s.visible.length > 0);
  if (mode === "none" || withData.length === 0) return { blocks: [] };
  if (mode === "summary") return { blocks: withData.map(({ s, slot }) => summaryBlock(s, slot)) };
  if (mode === "trend") return { blocks: withData.map(({ s, slot }) => trendBlock(s, slot)) };
  if (withData.length < 2) return { blocks: [] };
  const blocks = [pairBlock(withData[0].s, withData[1].s, true)];
  if (withData.length > 2) blocks.push(pairBlock(withData[0].s, withData[2].s, false));
  return { blocks, footnote: NO_CAUSE };
}
