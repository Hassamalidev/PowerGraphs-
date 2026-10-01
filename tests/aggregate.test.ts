import { describe, expect, it } from "vitest";
import { quarterlyMethodText, toQuarterly } from "@/lib/series/aggregate";
import { convertPeriod, monthToQuarter, normalizeMonth, periodLabel, quarterMonths, shiftPeriod, yearEarlier } from "@/lib/period";

const monthly = [
  { date: "2026-01", value: 600 },
  { date: "2026-02", value: 630 },
  { date: "2026-03", value: 660 },
  { date: "2026-04", value: 700 },
  { date: "2026-05", value: 710 },
  { date: "2026-06", value: 720 },
];

describe("toQuarterly", () => {
  it("average: mean of the 3 months", () => {
    expect(toQuarterly(monthly, "average").points).toEqual([
      { date: "2026-Q1", value: 630 },
      { date: "2026-Q2", value: 710 },
    ]);
  });

  it("sum: total of the 3 months", () => {
    expect(toQuarterly(monthly, "sum").points).toEqual([
      { date: "2026-Q1", value: 1890 },
      { date: "2026-Q2", value: 2130 },
    ]);
  });

  it("last: value of the last month of the quarter", () => {
    expect(toQuarterly(monthly, "last").points).toEqual([
      { date: "2026-Q1", value: 660 },
      { date: "2026-Q2", value: 720 },
    ]);
  });

  it("leaves out a partial latest quarter and explains why", () => {
    const withPartial = [...monthly, { date: "2026-07", value: 730 }, { date: "2026-08", value: 740 }];
    const result = toQuarterly(withPartial, "average");
    expect(result.points.map((p) => p.date)).toEqual(["2026-Q1", "2026-Q2"]);
    expect(result.incompleteQuarterNote).toBe("Q3 2026 not shown yet — only 2 of 3 months are available.");
  });

  it("uses singular wording when only 1 month is available", () => {
    const result = toQuarterly([...monthly, { date: "2026-07", value: 730 }], "sum");
    expect(result.incompleteQuarterNote).toBe("Q3 2026 not shown yet — only 1 of 3 months is available.");
  });

  it("gives no note when every quarter is complete", () => {
    expect(toQuarterly(monthly, "average").incompleteQuarterNote).toBeUndefined();
  });

  it("drops an incomplete quarter in the middle without a note", () => {
    const gap = monthly.filter((p) => p.date !== "2026-02");
    const result = toQuarterly(gap, "average");
    expect(result.points.map((p) => p.date)).toEqual(["2026-Q2"]);
    expect(result.incompleteQuarterNote).toBeUndefined();
  });

  it("does not leave float artifacts", () => {
    const pts = [
      { date: "2026-01", value: 8.1 },
      { date: "2026-02", value: 8.2 },
      { date: "2026-03", value: 8.3 },
    ];
    expect(toQuarterly(pts, "average").points[0].value).toBe(8.2);
    expect(toQuarterly(pts, "sum").points[0].value).toBe(24.6);
  });

  it("handles quarters across years in order", () => {
    const pts = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03"].map((date, i) => ({ date, value: i }));
    expect(toQuarterly(pts, "last").points).toEqual([
      { date: "2025-Q4", value: 2 },
      { date: "2026-Q1", value: 5 },
    ]);
  });
});

describe("quarterlyMethodText", () => {
  it("describes each rule in plain words", () => {
    expect(quarterlyMethodText("average")).toBe("Quarterly average of monthly values");
    expect(quarterlyMethodText("sum")).toBe("Quarterly sum of monthly values");
    expect(quarterlyMethodText("last")).toBe("End of quarter value");
  });
});

describe("period helpers", () => {
  it("labels months and quarters", () => {
    expect(periodLabel("2026-08")).toBe("Aug 2026");
    expect(periodLabel("2026-Q3")).toBe("Q3 2026");
  });

  it("maps months to quarters and back", () => {
    expect(monthToQuarter("2026-08")).toBe("2026-Q3");
    expect(monthToQuarter("2026-12")).toBe("2026-Q4");
    expect(quarterMonths("2026-Q1")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });

  it("shifts across year boundaries", () => {
    expect(shiftPeriod("2026-01", -1)).toBe("2025-12");
    expect(shiftPeriod("2025-12", 1)).toBe("2026-01");
    expect(shiftPeriod("2026-Q1", -1)).toBe("2025-Q4");
    expect(yearEarlier("2026-08")).toBe("2025-08");
    expect(yearEarlier("2026-Q2")).toBe("2025-Q2");
  });

  it("converts a range between views", () => {
    expect(convertPeriod("2021-01", "quarterly", "start")).toBe("2021-Q1");
    expect(convertPeriod("2026-08", "quarterly", "end")).toBe("2026-Q3");
    expect(convertPeriod("2021-Q1", "monthly", "start")).toBe("2021-01");
    expect(convertPeriod("2026-Q2", "monthly", "end")).toBe("2026-06");
  });

  it("normalizes Census month formats", () => {
    expect(normalizeMonth("2024-03")).toBe("2024-03");
    expect(normalizeMonth("2024-3")).toBe("2024-03");
    expect(normalizeMonth("Mar-2024")).toBe("2024-03");
    expect(normalizeMonth("2024-13")).toBeNull();
    expect(normalizeMonth("2024")).toBeNull();
  });
});
