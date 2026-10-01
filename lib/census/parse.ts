import { normalizeMonth } from "@/lib/period";

/** One Census EITS row, keyed by the API's column names. Every value is a string. */
export type EitsRow = Record<string, string>;

export type MonthlyPoint = { date: string; value: number };

export type SeriesSelector = {
  category_code: string;
  data_type_code: string;
  seasonally_adj: "yes" | "no";
  geo_level_code: string;
};

/** The API returns an array of arrays; the first row is the column headers. */
export function parseEitsResponse(json: unknown): EitsRow[] {
  if (!Array.isArray(json) || json.length === 0 || !Array.isArray(json[0])) {
    throw new Error("Unexpected Census response: expected an array of arrays.");
  }
  const headers = (json[0] as unknown[]).map(String);
  const rows: EitsRow[] = [];
  for (const raw of json.slice(1)) {
    if (!Array.isArray(raw)) continue;
    const row: EitsRow = {};
    headers.forEach((h, i) => {
      row[h] = raw[i] == null ? "" : String(raw[i]);
    });
    rows.push(row);
  }
  return rows;
}

/** Parse a cell value. Returns null for "(NA)", "(S)", "(X)", empty, etc. */
export function parseCellValue(raw: string | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/,/g, "");
  if (s === "" || !/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pick one series out of the program rows and normalize it:
 * actual values only (error_data "no"), numeric, "YYYY-MM" dates, sorted
 * ascending, one value per date, scaled.
 */
export function rowsToPoints(rows: EitsRow[], selector: SeriesSelector, scale: number): MonthlyPoint[] {
  const byDate = new Map<string, number>();
  for (const row of rows) {
    if (row.error_data !== "no") continue;
    if (
      row.category_code !== selector.category_code ||
      row.data_type_code !== selector.data_type_code ||
      row.seasonally_adj !== selector.seasonally_adj ||
      row.geo_level_code !== selector.geo_level_code
    ) {
      continue;
    }
    const value = parseCellValue(row.cell_value);
    if (value === null) continue;
    const date = normalizeMonth(row.time ?? "");
    if (!date) continue;
    // Round away float artifacts from scaling (e.g. 8.6 * 1 stays 8.6, 672 * 1000 = 672000).
    byDate.set(date, Math.round(value * scale * 1e6) / 1e6);
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

/** Split one CSV line, honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const SECTION_NAMES = [
  "CATEGORIES",
  "DATA TYPES",
  "ERROR TYPES",
  "GEO LEVELS",
  "TIME PERIODS",
  "NOTES",
  "DATA UPDATED ON",
  "DATA",
];

export type DatasetFile = {
  rows: EitsRow[];
  /** Raw "DATA UPDATED ON" text, e.g. "Thursday, 24-Sep-26 09:06:41 EDT". */
  updatedOnText: string | null;
  /** Parsed date (YYYY-MM-DD) of the above, if it could be read. */
  updatedOn: string | null;
  descriptions: {
    categories: Record<string, string>;
    dataTypes: Record<string, { desc: string; unit: string }>;
    geo: Record<string, string>;
  };
};

/**
 * Parse the Census "Download Data Sets" time-series file (e.g. RESSALES-mf.csv)
 * into the same row shape the EITS API returns, so both sources share
 * rowsToPoints().
 */
export function parseDatasetFile(csv: string): DatasetFile {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const rawLine of csv.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (SECTION_NAMES.includes(line.trim())) {
      current = line.trim();
      sections[current] = [];
    } else if (current && line.trim() !== "") {
      sections[current].push(line);
    }
  }
  if (!sections["DATA"] || !sections["TIME PERIODS"]) {
    throw new Error("Unexpected Census data file: DATA section not found.");
  }

  // Each lookup section is "idx,code,description[,unit]" under a header row.
  const lookup = (name: string) => {
    const map = new Map<string, string[]>();
    for (const line of (sections[name] ?? []).slice(1)) {
      const cells = splitCsvLine(line);
      map.set(cells[0], cells);
    }
    return map;
  };
  const cats = lookup("CATEGORIES");
  const dataTypes = lookup("DATA TYPES");
  const errTypes = lookup("ERROR TYPES");
  const geos = lookup("GEO LEVELS");
  const periods = lookup("TIME PERIODS");

  const header = splitCsvLine(sections["DATA"][0]);
  const col = (name: string) => header.indexOf(name);
  const iPer = col("per_idx");
  const iCat = col("cat_idx");
  const iDt = col("dt_idx");
  const iEt = col("et_idx"); // only present when the program publishes error data
  const iGeo = col("geo_idx");
  const iAdj = col("is_adj");
  const iVal = col("val");

  const rows: EitsRow[] = [];
  for (const line of sections["DATA"].slice(1)) {
    const c = splitCsvLine(line);
    const isError = iEt >= 0 && c[iEt] !== "0" && c[iEt] !== "";
    const time = normalizeMonth(periods.get(c[iPer])?.[1] ?? "");
    if (!time) continue;
    rows.push({
      cell_value: c[iVal] ?? "",
      data_type_code: isError ? (errTypes.get(c[iEt])?.[1] ?? "") : (dataTypes.get(c[iDt])?.[1] ?? ""),
      category_code: cats.get(c[iCat])?.[1] ?? "",
      seasonally_adj: c[iAdj] === "1" ? "yes" : "no",
      error_data: isError ? "yes" : "no",
      geo_level_code: geos.get(c[iGeo])?.[1] ?? "",
      time,
    });
  }

  const updatedOnText = sections["DATA UPDATED ON"]?.[0]?.trim() ?? null;
  const toRecord = (m: Map<string, string[]>) => Object.fromEntries([...m.values()].map((c) => [c[1], c[2]]));
  return {
    rows,
    updatedOnText,
    updatedOn: updatedOnText ? parseUpdatedOn(updatedOnText) : null,
    descriptions: {
      categories: toRecord(cats),
      dataTypes: Object.fromEntries([...dataTypes.values()].map((c) => [c[1], { desc: c[2], unit: c[3] }])),
      geo: toRecord(geos),
    },
  };
}

/** "Thursday, 24-Sep-26 09:06:41 EDT" → "2026-09-24". */
export function parseUpdatedOn(text: string): string | null {
  const m = /(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(text);
  if (!m) return null;
  const month = normalizeMonth(`${m[2]}-2000`);
  if (!month) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return `${year}-${month.slice(5)}-${m[1].padStart(2, "0")}`;
}
