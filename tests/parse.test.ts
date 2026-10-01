import { describe, expect, it } from "vitest";
import {
  parseCellValue,
  parseDatasetFile,
  parseEitsResponse,
  parseUpdatedOn,
  rowsToPoints,
  type SeriesSelector,
} from "@/lib/census/parse";

const HEADERS = ["cell_value", "data_type_code", "category_code", "seasonally_adj", "error_data", "time_slot_id", "geo_level_code", "time", "us"];

const row = (value: string, time: string, over: Partial<Record<string, string>> = {}) => [
  value,
  over.data_type_code ?? "TOTAL",
  over.category_code ?? "ASOLD",
  over.seasonally_adj ?? "yes",
  over.error_data ?? "no",
  "0",
  over.geo_level_code ?? "US",
  time,
  "1",
];

const SOLD_RATE: SeriesSelector = { category_code: "ASOLD", data_type_code: "TOTAL", seasonally_adj: "yes", geo_level_code: "US" };

describe("parseEitsResponse", () => {
  it("turns an array of arrays into objects using the header row", () => {
    const rows = parseEitsResponse([HEADERS, row("672", "2026-06")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cell_value: "672", category_code: "ASOLD", time: "2026-06", error_data: "no" });
  });

  it("rejects anything that is not an array of arrays", () => {
    expect(() => parseEitsResponse({ error: "nope" })).toThrow();
    expect(() => parseEitsResponse([])).toThrow();
  });
});

describe("parseCellValue", () => {
  it("parses plain numbers", () => {
    expect(parseCellValue("672")).toBe(672);
    expect(parseCellValue("8.5")).toBe(8.5);
    expect(parseCellValue(" 1,234 ")).toBe(1234);
    expect(parseCellValue("-3")).toBe(-3);
  });

  it("returns null for Census placeholders and blanks", () => {
    for (const v of ["(NA)", "(S)", "(X)", "", "  ", "abc", undefined]) expect(parseCellValue(v)).toBeNull();
  });
});

describe("rowsToPoints", () => {
  it("keeps only rows where error_data is 'no'", () => {
    const rows = parseEitsResponse([
      HEADERS,
      row("672", "2026-06"),
      row("7", "2026-06", { error_data: "yes", data_type_code: "E_TOTAL" }),
      // Same codes as the real series but flagged as error data: must still be dropped.
      row("999", "2026-07", { error_data: "yes" }),
    ]);
    expect(rowsToPoints(rows, SOLD_RATE, 1000)).toEqual([{ date: "2026-06", value: 672000 }]);
  });

  it("skips non-numeric values", () => {
    const rows = parseEitsResponse([HEADERS, row("(NA)", "2026-05"), row("(S)", "2026-06"), row("", "2026-07"), row("684", "2026-08")]);
    expect(rowsToPoints(rows, SOLD_RATE, 1000)).toEqual([{ date: "2026-08", value: 684000 }]);
  });

  it("selects only the requested series", () => {
    const rows = parseEitsResponse([
      HEADERS,
      row("672", "2026-06"),
      row("58", "2026-06", { category_code: "SOLD", seasonally_adj: "no" }),
      row("31", "2026-06", { geo_level_code: "NO" }),
      row("406400", "2026-06", { category_code: "SOLD", data_type_code: "MEDIAN", seasonally_adj: "no" }),
    ]);
    expect(rowsToPoints(rows, SOLD_RATE, 1000)).toEqual([{ date: "2026-06", value: 672000 }]);
    expect(rowsToPoints(rows, { ...SOLD_RATE, geo_level_code: "NO" }, 1000)).toEqual([{ date: "2026-06", value: 31000 }]);
  });

  it("sorts ascending, normalizes dates, and keeps one value per date", () => {
    const rows = parseEitsResponse([HEADERS, row("684", "2026-08"), row("672", "2026-6"), row("643", "2026-07"), row("650", "2026-07")]);
    expect(rowsToPoints(rows, SOLD_RATE, 1)).toEqual([
      { date: "2026-06", value: 672 },
      { date: "2026-07", value: 650 },
      { date: "2026-08", value: 684 },
    ]);
  });

  it("applies the scale without float artifacts", () => {
    const rows = parseEitsResponse([HEADERS, row("8.6", "2026-06", { category_code: "FORSALE", data_type_code: "MONSUP" })]);
    const points = rowsToPoints(rows, { category_code: "FORSALE", data_type_code: "MONSUP", seasonally_adj: "yes", geo_level_code: "US" }, 1);
    expect(points[0].value).toBe(8.6);
  });
});

const FILE = `CATEGORIES
cat_idx,cat_code,cat_desc,cat_indent
1,SOLD,"New Single-family Houses Sold",0
2,ASOLD,"Annual Rate for New Single-family Houses Sold",0


DATA TYPES
dt_idx,dt_code,dt_desc,dt_unit
1,TOTAL,"All Houses",K
5,MEDIAN,"Median Sales Price",DOL


ERROR TYPES
et_idx,err_code,err_desc,err_unit
1,E_TOTAL,"Relative Standard Error for All Houses",PCT


GEO LEVELS
geo_idx,geo_code,geo_desc
1,US,"United States"
2,NO,"Northeast"


TIME PERIODS
per_idx,per_name
1,Jun-2026
2,Jul-2026
3,Aug-2026
4,Sep-2026


NOTES
"Some note, with a comma"


DATA UPDATED ON
Thursday, 24-Sep-26 09:06:41 EDT


DATA
per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val
1,2,1,0,1,1,672
2,2,1,0,1,1,643
3,2,1,0,1,1,684
3,2,0,1,1,1,8
3,1,5,0,1,0,393700
3,2,1,0,2,1,23
`;

describe("parseDatasetFile", () => {
  const file = parseDatasetFile(FILE);

  it("converts the file into API-shaped rows", () => {
    expect(file.rows).toHaveLength(6);
    expect(file.rows[0]).toEqual({
      cell_value: "672",
      data_type_code: "TOTAL",
      category_code: "ASOLD",
      seasonally_adj: "yes",
      error_data: "no",
      geo_level_code: "US",
      time: "2026-06",
    });
  });

  it("marks error rows so they are filtered out", () => {
    const errorRow = file.rows.find((r) => r.error_data === "yes");
    expect(errorRow).toMatchObject({ data_type_code: "E_TOTAL", cell_value: "8" });
    expect(rowsToPoints(file.rows, SOLD_RATE, 1000)).toEqual([
      { date: "2026-06", value: 672000 },
      { date: "2026-07", value: 643000 },
      { date: "2026-08", value: 684000 },
    ]);
  });

  it("reads the data-updated date and descriptions", () => {
    expect(file.updatedOn).toBe("2026-09-24");
    expect(file.descriptions.dataTypes.MEDIAN).toEqual({ desc: "Median Sales Price", unit: "DOL" });
    expect(file.descriptions.geo.NO).toBe("Northeast");
  });

  it("throws on a file without a DATA section", () => {
    expect(() => parseDatasetFile("<html>Missing Key</html>")).toThrow();
  });
});

describe("parseUpdatedOn", () => {
  it("handles 2- and 4-digit years", () => {
    expect(parseUpdatedOn("Thursday, 24-Sep-26 09:06:41 EDT")).toBe("2026-09-24");
    expect(parseUpdatedOn("5-Jan-2027")).toBe("2027-01-05");
    expect(parseUpdatedOn("no date here")).toBeNull();
  });
});
