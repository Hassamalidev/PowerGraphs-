import { parseCellValue, type DatasetFile } from "@/lib/census/parse";
import type { DatasetSource, QuarterlyRule, Unit } from "./catalog";

// Works out which Census series could be added as new datasets, and suggests
// a plain-English name for each. Pure functions — no network or database.

export type AvailableSeries = {
  id: string; // stable id built from the Census codes, e.g. "c_forsale_underc_no_us"
  source: DatasetSource;
  /** A plain name the user can keep or change. */
  suggestedName: string;
  /** What Census calls it. */
  censusDescription: string;
  unit: Unit;
  unitLabel: string;
  scale: number;
  quarterly: Exclude<QuarterlyRule, "official">;
  firstDate: string; // YYYY-MM
  lastDate: string;
  latestValue: number; // already scaled
  points: number;
};

const CATEGORY_NAMES: Record<string, string> = {
  SOLD: "New homes sold (actual number that month)",
  ASOLD: "New homes sold (yearly pace)",
  FORSALE: "New homes for sale",
};

// Data types that describe a stage of building, added after the category name.
const STAGE_NAMES: Record<string, string> = {
  NOTSTD: "not started yet",
  UNDERC: "under construction",
  COMPED: "finished",
};

// Data types that are a measure of their own, used instead of the category name.
const MEASURE_NAMES: Record<string, string> = {
  MEDIAN: "Median price of new homes sold",
  AVERAG: "Average price of new homes sold",
  MONSUP: "Months' supply of new homes",
  MMTHS: "Time finished homes wait for a buyer",
};

/** How Census's unit codes map onto the app's units. Unknown codes can't be charted yet. */
function unitFor(unitCode: string, category: string): Pick<AvailableSeries, "unit" | "unitLabel" | "scale"> | null {
  if (unitCode === "K") {
    return category === "ASOLD"
      ? { unit: "homes_per_year", unitLabel: "Homes per year", scale: 1000 }
      : { unit: "homes", unitLabel: "Homes", scale: 1000 };
  }
  if (unitCode === "DOL") return { unit: "dollars", unitLabel: "Dollars", scale: 1 };
  if (unitCode === "MO") return { unit: "months", unitLabel: "Months", scale: 1 };
  return null;
}

/** Quarterly rule: yearly rates, prices and ratios are averaged; monthly counts are added up; stock uses the quarter's last month. */
function quarterlyFor(unit: Unit, category: string): AvailableSeries["quarterly"] {
  if (unit !== "homes") return "average";
  return category === "FORSALE" ? "last" : "sum";
}

export function seriesId(source: Pick<DatasetSource, "category_code" | "data_type_code" | "seasonally_adj" | "geo_level_code">): string {
  return ["c", source.category_code, source.data_type_code, source.seasonally_adj, source.geo_level_code].join("_").toLowerCase();
}

const sameSeries = (a: DatasetSource, b: DatasetSource) =>
  a.category_code === b.category_code &&
  a.data_type_code === b.data_type_code &&
  a.seasonally_adj === b.seasonally_adj &&
  a.geo_level_code === b.geo_level_code;

/**
 * Every series in the Census file that isn't already a dataset.
 * @param existing the sources of datasets already in the catalog (built-in and added)
 */
export function listAvailable(file: DatasetFile, existing: DatasetSource[]): AvailableSeries[] {
  type Group = { source: DatasetSource; values: Map<string, number> };
  const groups = new Map<string, Group>();

  for (const row of file.rows) {
    if (row.error_data !== "no") continue;
    const value = parseCellValue(row.cell_value);
    if (value === null) continue;
    const source: DatasetSource = {
      provider: "census-eits",
      program: "ressales",
      category_code: row.category_code,
      data_type_code: row.data_type_code,
      seasonally_adj: row.seasonally_adj === "yes" ? "yes" : "no",
      geo_level_code: row.geo_level_code,
    };
    const key = seriesId(source);
    if (!groups.has(key)) groups.set(key, { source, values: new Map() });
    groups.get(key)!.values.set(row.time, value);
  }

  // A series offered both adjusted and not adjusted needs that said in its name.
  const variants = new Map<string, number>();
  for (const { source } of groups.values()) {
    const k = [source.category_code, source.data_type_code, source.geo_level_code].join("|");
    variants.set(k, (variants.get(k) ?? 0) + 1);
  }

  const out: AvailableSeries[] = [];
  for (const [id, { source, values }] of groups) {
    if (existing.some((e) => sameSeries(e, source))) continue;
    const type = file.descriptions.dataTypes[source.data_type_code];
    const unit = type ? unitFor(type.unit, source.category_code) : null;
    if (!unit || values.size < 12) continue;

    const dates = [...values.keys()].sort();
    const lastDate = dates[dates.length - 1];
    const categoryDesc = file.descriptions.categories[source.category_code] ?? source.category_code;
    const geoDesc = file.descriptions.geo[source.geo_level_code] ?? source.geo_level_code;

    const parts = [MEASURE_NAMES[source.data_type_code] ?? CATEGORY_NAMES[source.category_code] ?? categoryDesc];
    if (STAGE_NAMES[source.data_type_code]) parts.push(STAGE_NAMES[source.data_type_code]);
    else if (!MEASURE_NAMES[source.data_type_code] && source.data_type_code !== "TOTAL") parts.push(type.desc);
    if (source.geo_level_code !== "US") parts.push(geoDesc);
    let suggestedName = parts.join(" — ");
    const bothVariants = variants.get([source.category_code, source.data_type_code, source.geo_level_code].join("|"))! > 1;
    if (bothVariants) suggestedName += source.seasonally_adj === "yes" ? " (adjusted for seasons)" : " (not adjusted for seasons)";

    out.push({
      id,
      source,
      suggestedName,
      censusDescription: `${categoryDesc}: ${type.desc}, ${geoDesc}, ${source.seasonally_adj === "yes" ? "seasonally adjusted" : "not seasonally adjusted"}`,
      ...unit,
      quarterly: quarterlyFor(unit.unit, source.category_code),
      firstDate: dates[0],
      lastDate,
      latestValue: Math.round(values.get(lastDate)! * unit.scale * 1e6) / 1e6,
      points: dates.length,
    });
  }
  return out.sort((a, b) => a.suggestedName.localeCompare(b.suggestedName));
}
