import { describe, expect, it } from "vitest";
import { parseDatasetFile } from "@/lib/census/parse";
import { listAvailable, seriesId } from "@/lib/datasets/available";
import { CATALOG } from "@/lib/datasets/catalog";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A small Census file: each series gets 12 months of the same value. */
function makeFile(series: [cat: number, dt: number, et: number, geo: number, adj: number, value: string][]) {
  const data = series.flatMap(([cat, dt, et, geo, adj, value]) => months.map((_, i) => `${i + 1},${cat},${dt},${et},${geo},${adj},${value}`));
  return parseDatasetFile(
    [
      "CATEGORIES",
      "cat_idx,cat_code,cat_desc,cat_indent",
      '1,SOLD,"New Single-family Houses Sold",0',
      '2,ASOLD,"Annual Rate for New Single-family Houses Sold",0',
      '3,FORSALE,"New Single-family Houses For Sale",0',
      "",
      "",
      "DATA TYPES",
      "dt_idx,dt_code,dt_desc,dt_unit",
      '1,TOTAL,"All Houses",K',
      '3,UNDERC,"Houses that are Under Construction",K',
      '5,MEDIAN,"Median Sales Price",DOL',
      '7,MONSUP,"Months\' Supply at Current Sales Rate",MO',
      '9,PCTCHG,"Percent Change",PCT',
      "",
      "",
      "ERROR TYPES",
      "et_idx,err_code,err_desc,err_unit",
      '1,E_TOTAL,"Relative Standard Error for All Houses",PCT',
      "",
      "",
      "GEO LEVELS",
      "geo_idx,geo_code,geo_desc",
      '1,US,"United States"',
      '3,MW,"Midwest"',
      "",
      "",
      "TIME PERIODS",
      "per_idx,per_name",
      ...months.map((m, i) => `${i + 1},${m}-2026`),
      "",
      "",
      "DATA",
      "per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val",
      ...data,
    ].join("\n"),
  );
}

describe("listAvailable", () => {
  const file = makeFile([
    [2, 1, 0, 1, 1, "684"], // yearly pace, US — already in the built-in catalog
    [3, 3, 0, 1, 1, "256"], // for sale, under construction, adjusted
    [3, 3, 0, 1, 0, "261"], // for sale, under construction, not adjusted
    [3, 1, 0, 3, 0, "58"], // for sale, Midwest
    [1, 3, 0, 1, 0, "22"], // sold, under construction
    [3, 7, 0, 1, 0, "8.5"], // months' supply, not adjusted
    [2, 0, 1, 1, 1, "8"], // an error-measure row
    [1, 9, 0, 1, 0, "3"], // a unit the app can't chart
  ]);
  const available = listAvailable(file, CATALOG.map((d) => d.source));
  const byId = Object.fromEntries(available.map((s) => [s.id, s]));

  it("leaves out series that are already datasets, error measures, and unsupported units", () => {
    expect(available.map((s) => s.id).sort()).toEqual([
      "c_forsale_monsup_no_us",
      "c_forsale_total_no_mw",
      "c_forsale_underc_no_us",
      "c_forsale_underc_yes_us",
      "c_sold_underc_no_us",
    ]);
  });

  it("suggests plain names, and says which is adjusted when both exist", () => {
    expect(byId.c_forsale_underc_yes_us.suggestedName).toBe("New homes for sale — under construction (adjusted for seasons)");
    expect(byId.c_forsale_underc_no_us.suggestedName).toBe("New homes for sale — under construction (not adjusted for seasons)");
    expect(byId.c_forsale_total_no_mw.suggestedName).toBe("New homes for sale — Midwest");
    expect(byId.c_sold_underc_no_us.suggestedName).toBe("New homes sold (actual number that month) — under construction");
  });

  it("works out the unit, scale, and quarterly rule", () => {
    expect(byId.c_forsale_underc_yes_us).toMatchObject({ unit: "homes", scale: 1000, quarterly: "last", latestValue: 256000 });
    expect(byId.c_sold_underc_no_us).toMatchObject({ unit: "homes", scale: 1000, quarterly: "sum", latestValue: 22000 });
    expect(byId.c_forsale_monsup_no_us).toMatchObject({ unit: "months", scale: 1, quarterly: "average", latestValue: 8.5 });
  });

  it("reports the date span", () => {
    expect(byId.c_forsale_total_no_mw).toMatchObject({ firstDate: "2026-01", lastDate: "2026-12", points: 12 });
  });

  it("stops offering a series once it has been added", () => {
    const again = listAvailable(file, [...CATALOG.map((d) => d.source), byId.c_forsale_total_no_mw.source]);
    expect(again.some((s) => s.id === "c_forsale_total_no_mw")).toBe(false);
  });

  it("builds stable ids from the Census codes", () => {
    expect(seriesId({ category_code: "FORSALE", data_type_code: "UNDERC", seasonally_adj: "no", geo_level_code: "US" })).toBe("c_forsale_underc_no_us");
  });
});
