import { describe, expect, it } from "vitest";
import { changeWords, formatApprox, formatCompact, formatPercent, formatSignedPercent, formatValue, formatValueWithUnit } from "@/lib/format";
import { shiftPeriod } from "@/lib/period";
import { alignByDate, computeRelationship, correlationStrength, niceStep } from "@/lib/stats/relationship";
import {
  buildStatsText,
  NO_CAUSE,
  NOT_ENOUGH_FOR_TREND,
  relationshipSentences,
  summarySentence,
  trendSentence,
  type StatsSeries,
} from "@/lib/stats/sentences";
import { computeSummary } from "@/lib/stats/summary";
import { computeTrend, fitStrength } from "@/lib/stats/trend";
import type { Pt } from "@/lib/stats/types";

/** Build a run of consecutive periods starting at `start`. */
function run(start: string, values: number[]): Pt[] {
  return values.map((value, i) => ({ date: shiftPeriod(start, i), value }));
}

function series(over: Partial<StatsSeries> & { visible: Pt[] }): StatsSeries {
  return { name: "New homes sold (yearly pace)", shortName: "New homes sold", unit: "homes_per_year", all: over.visible, ...over };
}

describe("computeSummary", () => {
  // 14 months: Jul 2025 .. Aug 2026
  const all = run("2025-07", [600, 700, 610, 620, 630, 640, 650, 500, 670, 680, 900, 660, 640, 672]);
  const visible = all.slice(6); // Jan 2026 .. Aug 2026
  const s = computeSummary(visible, all)!;

  it("finds the latest value and its date", () => {
    expect(s.latest).toEqual({ date: "2026-08", value: 672 });
    expect(s.first).toEqual({ date: "2026-01", value: 650 });
  });

  it("computes change from the previous period", () => {
    expect(s.fromPrevious!.from.date).toBe("2026-07");
    expect(s.fromPrevious!.absolute).toBe(32);
    expect(s.fromPrevious!.percent).toBeCloseTo(5, 10);
  });

  it("computes change from a year earlier, even when that is outside the visible range", () => {
    expect(s.fromYearEarlier!.from).toEqual({ date: "2025-08", value: 700 });
    expect(s.fromYearEarlier!.percent).toBeCloseTo(-4, 10);
  });

  it("computes change over the selected range", () => {
    expect(s.overRange.absolute).toBe(22);
    expect(s.overRange.percent).toBeCloseTo((22 / 650) * 100, 10);
  });

  it("finds highest, lowest, and average in the visible range only", () => {
    expect(s.highest).toEqual({ date: "2026-05", value: 900 });
    expect(s.lowest).toEqual({ date: "2026-02", value: 500 });
    expect(s.average).toBeCloseTo((650 + 500 + 670 + 680 + 900 + 660 + 640 + 672) / 8, 10);
  });

  it("returns null changes when the earlier period is missing", () => {
    const only = run("2026-08", [672]);
    const one = computeSummary(only, only)!;
    expect(one.fromPrevious).toBeNull();
    expect(one.fromYearEarlier).toBeNull();
    expect(computeSummary([], [])).toBeNull();
  });

  it("looks back 4 quarters in quarterly view", () => {
    const q = run("2025-Q1", [100, 110, 120, 130, 150, 165]);
    const sum = computeSummary(q.slice(2), q)!;
    expect(sum.fromPrevious!.from.date).toBe("2026-Q1");
    expect(sum.fromYearEarlier!.from.date).toBe("2025-Q2");
    expect(sum.fromYearEarlier!.percent).toBeCloseTo(50, 10);
  });
});

describe("computeTrend", () => {
  it("fits an exact monthly line: slope is change per year", () => {
    // +10 per month = +120 per year
    const t = computeTrend(run("2025-01", [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210]))!;
    expect(t.slope).toBeCloseTo(120, 8);
    expect(t.intercept).toBeCloseTo(100, 8);
    expect(t.r2).toBeCloseTo(1, 10);
    expect(t.fitted).toHaveLength(12);
    expect(t.fitted[11].value).toBeCloseTo(210, 8);
  });

  it("uses a quarterly step of 1/4 year", () => {
    // -5 per quarter = -20 per year
    const t = computeTrend(run("2024-Q1", [100, 95, 90, 85, 80, 75, 70, 65]))!;
    expect(t.slope).toBeCloseTo(-20, 8);
    expect(t.r2).toBeCloseTo(1, 10);
  });

  it("matches a hand-computed least-squares fit", () => {
    // t (years) = 0, 1/12, …, 5/12 ; y = 1, 3, 2, 5, 4, 6
    // In months: Sxy = 15.5, Sxx = Syy = 17.5 → slope = 15.5/17.5 per month (×12 per year); R² = (15.5/17.5)²
    const t = computeTrend(run("2026-01", [1, 3, 2, 5, 4, 6]))!;
    expect(t.slope).toBeCloseTo((15.5 / 17.5) * 12, 8);
    expect(t.intercept).toBeCloseTo(3.5 - (15.5 / 17.5) * 2.5, 8);
    expect(t.r2).toBeCloseTo((15.5 * 15.5) / (17.5 * 17.5), 8);
  });

  it("handles gaps: time is measured by the calendar, not by position", () => {
    const pts = run("2025-01", [100, 110, 120, 130, 140, 150, 160, 170]).filter((_, i) => i !== 3 && i !== 4);
    const t = computeTrend(pts)!;
    expect(t.slope).toBeCloseTo(120, 8);
  });

  it("needs at least 6 points", () => {
    expect(computeTrend(run("2026-01", [1, 2, 3, 4, 5]))).toBeNull();
    expect(computeTrend(run("2026-01", [1, 2, 3, 4, 5, 6]))).not.toBeNull();
  });

  it("treats a perfectly flat series as flat, not as an error", () => {
    const t = computeTrend(run("2026-01", [5, 5, 5, 5, 5, 5]))!;
    expect(t.slope).toBeCloseTo(0, 10);
    expect(t.r2).toBe(1);
  });

  it("words the fit by R²", () => {
    expect(fitStrength(0.7)).toBe("close");
    expect(fitStrength(0.699)).toBe("close"); // shows as 0.70
    expect(fitStrength(0.55)).toBe("moderate");
    expect(fitStrength(0.4)).toBe("moderate");
    expect(fitStrength(0.39)).toBe("weak");
  });
});

describe("computeRelationship", () => {
  const x = run("2025-01", [1, 2, 3, 4, 5, 6, 7, 8]);

  it("finds a perfect positive relationship", () => {
    const y = run("2025-01", [12, 14, 16, 18, 20, 22, 24, 26]); // y = 10 + 2x
    const r = computeRelationship(y, x)!;
    expect(r.r).toBeCloseTo(1, 10);
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(10, 10);
    expect(r.n).toBe(8);
  });

  it("finds a perfect negative relationship", () => {
    const y = run("2025-01", [8, 7, 6, 5, 4, 3, 2, 1]);
    const r = computeRelationship(y, x)!;
    expect(r.r).toBeCloseTo(-1, 10);
    expect(r.slope).toBeCloseTo(-1, 10);
  });

  it("matches a hand-computed correlation", () => {
    // x = 1..8, y = 2,1,4,3,6,5,8,7 → Sxy = 38, Sxx = Syy = 42 → r = 38/42
    const y = run("2025-01", [2, 1, 4, 3, 6, 5, 8, 7]);
    const r = computeRelationship(y, x)!;
    expect(r.r).toBeCloseTo(38 / 42, 10);
    expect(r.slope).toBeCloseTo(38 / 42, 10);
  });

  it("only uses dates both datasets have, and needs at least 8 of them", () => {
    const y = run("2025-02", [1, 2, 3, 4, 5, 6, 7, 8]); // overlaps x on 7 dates
    expect(alignByDate(y, x)).toHaveLength(7);
    expect(computeRelationship(y, x)).toBeNull();
  });

  it("returns null when a dataset never changes", () => {
    expect(computeRelationship(run("2025-01", [5, 5, 5, 5, 5, 5, 5, 5]), x)).toBeNull();
  });

  it("words the strength by |r|", () => {
    expect(correlationStrength(0.7)).toBe("strong");
    expect(correlationStrength(-0.85)).toBe("strong");
    expect(correlationStrength(-0.52)).toBe("moderate");
    expect(correlationStrength(0.4)).toBe("moderate");
    expect(correlationStrength(0.39)).toBe("weak");
  });

  it("picks round steps", () => {
    expect(niceStep(13400)).toBe(10000);
    expect(niceStep(27000)).toBe(20000);
    expect(niceStep(60000)).toBe(50000);
    expect(niceStep(0.7)).toBe(0.5);
    expect(niceStep(0)).toBe(1);
  });
});

describe("sentences", () => {
  it("writes the plain summary in the spec's template", () => {
    const all = run("2025-07", [600000, 692600, 610000, 620000, 630000, 640000, 993000, 588000, 670000, 680000, 690000, 660000, 655700, 676000]);
    const text = summarySentence(series({ visible: all.slice(6), all }));
    expect(text).toBe(
      "New homes sold (yearly pace): 676,000 in Aug 2026 — up 3.1% from Jul 2026 and down 2.4% from Aug 2025. " +
        "Over Jan 2026 – Aug 2026 it went from 993,000 to 676,000 (down 31.9%). " +
        "Highest: 993,000 (Jan 2026). Lowest: 588,000 (Feb 2026). Average: 701,588.",
    );
  });

  it("says 'unchanged' when a change rounds to 0.0%", () => {
    const all = run("2026-01", [1000, 1000.2]);
    expect(summarySentence(series({ visible: all, all }))).toContain("unchanged from Jan 2026");
  });

  it("formats dollars and months with their units", () => {
    const price = run("2026-01", [400000, 414500]);
    expect(summarySentence(series({ name: "Median price", unit: "dollars", visible: price }))).toContain("Median price: $414,500 in Feb 2026");
    const supply = run("2026-01", [8.0, 8.5]);
    expect(summarySentence(series({ name: "Months' supply", unit: "months", visible: supply }))).toContain("8.5 months in Feb 2026");
  });

  it("writes the trend sentence with direction and fit", () => {
    // falls 52,000 a year, exactly
    const falling = run("2021-01", Array.from({ length: 24 }, (_, i) => 993000 - (52000 / 12) * i));
    expect(trendSentence(series({ visible: falling }))).toBe(
      "New homes sold (yearly pace) has been falling by about 52,000 per year over Jan 2021 – Dec 2022. The data follows the trend closely (R² = 1.00).",
    );
  });

  it("says the trend is weak when the data jumps around", () => {
    const noisy = run("2026-01", [5, 1, 6, 1, 5, 2, 6, 1]);
    expect(trendSentence(series({ visible: noisy, unit: "months" }))).toContain("jumps around a lot, so the trend is weak");
  });

  it("asks for a longer range when there are too few points", () => {
    expect(trendSentence(series({ visible: run("2026-01", [1, 2, 3]) }))).toContain(NOT_ENOUGH_FOR_TREND);
  });

  it("describes how two datasets move together, with the no-cause sentence", () => {
    const price = run("2025-01", [400000, 410000, 420000, 430000, 440000, 450000, 460000, 470000]);
    // sales fall 18,000 for every $10,000 of price
    const sales = price.map((p) => ({ date: p.date, value: 700000 - ((p.value - 400000) / 10000) * 18000 }));
    const text = relationshipSentences([
      series({ visible: sales }),
      series({ name: "Median price of new homes sold", shortName: "Median price", unit: "dollars", visible: price }),
    ]);
    expect(text).toBe(
      "New homes sold and Median price have a strong tendency to move in opposite directions (correlation −1.00). " +
        "On average, when Median price is $20,000 higher, New homes sold is about 36,000 lower. " +
        NO_CAUSE,
    );
  });

  it("also reports Dataset 1 against Dataset 3", () => {
    const a = series({ visible: run("2025-01", [1, 2, 3, 4, 5, 6, 7, 8]), shortName: "A" });
    const b = series({ visible: run("2025-01", [2, 4, 6, 8, 10, 12, 14, 16]), shortName: "B" });
    const c = series({ visible: run("2025-01", [8, 7, 6, 5, 4, 3, 2, 1]), shortName: "C" });
    const text = relationshipSentences([a, b, c]);
    expect(text).toContain("A and B have a strong tendency to move in the same direction (correlation 1.00).");
    expect(text).toContain("A and C have a strong tendency to move in opposite directions (correlation −1.00).");
    expect(text.endsWith(NO_CAUSE)).toBe(true);
  });

  it("explains when there is not enough shared data", () => {
    const a = series({ visible: run("2025-01", [1, 2, 3]), shortName: "A" });
    const b = series({ visible: run("2025-01", [1, 2, 3]), shortName: "B" });
    expect(relationshipSentences([a, b])).toContain("not enough shared data");
  });

  it("buildStatsText: one paragraph per dataset, empty when hidden", () => {
    const a = series({ visible: run("2026-01", [1, 2]) });
    expect(buildStatsText("none", [a])).toBe("");
    expect(buildStatsText("summary", [a, a]).split("\n\n")).toHaveLength(2);
  });
});

describe("number formatting", () => {
  it("formats values by unit", () => {
    expect(formatValue(676000, "homes_per_year")).toBe("676,000");
    expect(formatValue(414500, "dollars")).toBe("$414,500");
    expect(formatValue(8.5, "months")).toBe("8.5 months");
    expect(formatValueWithUnit(676000, "homes_per_year")).toBe("676,000 per year");
    expect(formatValueWithUnit(58000, "homes")).toBe("58,000 homes");
  });

  it("formats compact axis values", () => {
    expect(formatCompact(676000, "homes")).toBe("676K");
    expect(formatCompact(414500, "dollars")).toBe("$415K");
    expect(formatCompact(1200000, "homes")).toBe("1.2M");
    expect(formatCompact(8.5, "months")).toBe("8.5");
  });

  it("never shows float artifacts", () => {
    expect(formatValue(0.1 + 0.2, "months")).toBe("0.3 months");
    expect(formatValue(675999.9999999, "homes")).toBe("676,000");
    expect(formatPercent(3.0999999)).toBe("3.1%");
  });

  it("uses words for direction", () => {
    expect(changeWords(3.14)).toBe("up 3.1%");
    expect(changeWords(-2.4)).toBe("down 2.4%");
    expect(changeWords(0.04)).toBe("unchanged");
    expect(formatSignedPercent(-2.44)).toBe("-2.4%");
    expect(formatSignedPercent(0.01)).toBe("0.0%");
  });

  it("rounds 'about' amounts to 2 significant figures", () => {
    expect(formatApprox(-52345, "homes_per_year")).toBe("52,000");
    expect(formatApprox(18499, "dollars")).toBe("$18,000");
    expect(formatApprox(0.44, "months")).toBe("0.4 months");
  });
});
