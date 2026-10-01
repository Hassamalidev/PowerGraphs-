// The dataset catalog. Adding a dataset later should only need a new entry here
// (and, for a new source, a new fetcher in lib/census/).
//
// All Census codes below were confirmed against the real data in Step 0 —
// see docs/census-ressales-codes.md.

export type Unit = "homes_per_year" | "homes" | "dollars" | "months";
export type QuarterlyRule = "average" | "sum" | "last" | "official";

export type DatasetSource = {
  provider: "census-eits";
  program: "ressales";
  category_code: string;
  data_type_code: string;
  seasonally_adj: "yes" | "no";
  geo_level_code: string;
};

export type DatasetDef = {
  id: string; // stable id used in URLs
  name: string; // plain name shown in dropdown
  shortName: string; // used inside the arrow label box and in sentences
  description: string; // one-line plain description under the dropdown option
  helpText: string; // shown in "?" tip
  group: string; // dropdown group
  source: DatasetSource;
  unit: Unit;
  unitLabel: string; // Y-axis label
  scale: number; // multiplier applied to raw values
  frequency: "monthly";
  // "official" means: use Census quarterly values when the source provides
  // them, otherwise fall back to `quarterlyFallback`.
  quarterly: QuarterlyRule;
  quarterlyFallback?: Exclude<QuarterlyRule, "official">;
  sourceLabel: string;
};

const SOURCE_LABEL = "U.S. Census Bureau, New Residential Sales";

const YEARLY_PACE_HELP =
  "How many new homes would be sold in a full year if sales kept going at this month's speed. Adjusted for normal seasonal ups and downs.";

function ressales(
  category_code: string,
  data_type_code: string,
  seasonally_adj: "yes" | "no",
  geo_level_code = "US",
): DatasetSource {
  return { provider: "census-eits", program: "ressales", category_code, data_type_code, seasonally_adj, geo_level_code };
}

function regional(id: string, region: string, geo: string): DatasetDef {
  return {
    id,
    name: `New homes sold — ${region} (yearly pace)`,
    shortName: `New homes sold, ${region}`,
    description: `Yearly sales pace in the ${region} only.`,
    helpText: `${YEARLY_PACE_HELP} Counts only homes in the ${region}.`,
    group: "By region",
    source: ressales("ASOLD", "TOTAL", "yes", geo),
    unit: "homes_per_year",
    unitLabel: "Homes per year",
    scale: 1000,
    frequency: "monthly",
    quarterly: "average",
    sourceLabel: SOURCE_LABEL,
  };
}

export const CATALOG: DatasetDef[] = [
  {
    id: "new_homes_sold_rate",
    name: "New homes sold (yearly pace)",
    shortName: "New homes sold",
    description: "How many homes would sell in a year at this month's speed.",
    helpText: YEARLY_PACE_HELP,
    group: "Home sales",
    source: ressales("ASOLD", "TOTAL", "yes"),
    unit: "homes_per_year",
    unitLabel: "Homes per year",
    scale: 1000,
    frequency: "monthly",
    quarterly: "average",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "new_homes_sold_count",
    name: "New homes sold (actual number that month)",
    shortName: "Homes sold that month",
    description: "The real count of homes sold each month, not adjusted for seasons.",
    helpText:
      "The actual number of new homes sold in that month. It is not adjusted for seasons, so spring months are usually higher than winter months.",
    group: "Home sales",
    source: ressales("SOLD", "TOTAL", "no"),
    unit: "homes",
    unitLabel: "Homes",
    scale: 1000,
    frequency: "monthly",
    quarterly: "sum",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "median_price",
    name: "Median price of new homes sold",
    shortName: "Median price",
    description: "The middle price: half sold for more, half for less.",
    helpText: "The middle price — half of new homes sold for more, half for less.",
    group: "Prices",
    source: ressales("SOLD", "MEDIAN", "no"),
    unit: "dollars",
    unitLabel: "Dollars",
    scale: 1,
    frequency: "monthly",
    quarterly: "official",
    quarterlyFallback: "average",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "average_price",
    name: "Average price of new homes sold",
    shortName: "Average price",
    description: "Total paid for all new homes, divided by the number sold.",
    helpText:
      "The total paid for all new homes sold, divided by the number of homes. A few very expensive homes can pull this number up.",
    group: "Prices",
    source: ressales("SOLD", "AVERAG", "no"),
    unit: "dollars",
    unitLabel: "Dollars",
    scale: 1,
    frequency: "monthly",
    quarterly: "official",
    quarterlyFallback: "average",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "homes_for_sale",
    name: "New homes for sale (end of month)",
    shortName: "Homes for sale",
    description: "New homes on the market at the end of each month.",
    helpText:
      "How many new homes were on the market at the end of the month. Adjusted for normal seasonal ups and downs.",
    group: "Homes for sale",
    source: ressales("FORSALE", "TOTAL", "yes"),
    unit: "homes",
    unitLabel: "Homes",
    scale: 1000,
    frequency: "monthly",
    quarterly: "last",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "homes_for_sale_completed",
    name: "Finished new homes for sale (end of month)",
    shortName: "Finished homes for sale",
    description: "Homes for sale that are already built and ready to move into.",
    helpText:
      "New homes for sale at the end of the month where construction is already finished. Adjusted for normal seasonal ups and downs.",
    group: "Homes for sale",
    source: ressales("FORSALE", "COMPED", "yes"),
    unit: "homes",
    unitLabel: "Homes",
    scale: 1000,
    frequency: "monthly",
    quarterly: "last",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "months_supply",
    name: "Months' supply of new homes",
    shortName: "Months' supply",
    description: "How long it would take to sell every home now for sale.",
    helpText:
      "How many months it would take to sell all new homes currently for sale, at the current sales speed.",
    group: "Homes for sale",
    source: ressales("FORSALE", "MONSUP", "yes"),
    unit: "months",
    unitLabel: "Months",
    scale: 1,
    frequency: "monthly",
    quarterly: "average",
    sourceLabel: SOURCE_LABEL,
  },
  {
    id: "months_on_market",
    name: "Time finished homes wait for a buyer",
    shortName: "Months on the market",
    description: "The middle number of months a finished home has been for sale.",
    helpText:
      "For finished new homes still for sale: the middle number of months since they were completed. Half have waited longer, half less.",
    group: "Homes for sale",
    source: ressales("FORSALE", "MMTHS", "no"),
    unit: "months",
    unitLabel: "Months",
    scale: 1,
    frequency: "monthly",
    quarterly: "average",
    sourceLabel: SOURCE_LABEL,
  },
  regional("sold_northeast", "Northeast", "NO"),
  regional("sold_midwest", "Midwest", "MW"),
  regional("sold_south", "South", "SO"),
  regional("sold_west", "West", "WE"),
];

export const DEFAULT_DATASET_ID = "new_homes_sold_rate";

/** A built-in dataset with its Census codes (server side). */
export function getBuiltInDef(id: string): DatasetDef | undefined {
  return CATALOG.find((d) => d.id === id);
}

/** The catalog as sent to the browser: no internal source codes. */
export type PublicDataset = Omit<DatasetDef, "source"> & { custom?: boolean };

export function publicCatalog(): PublicDataset[] {
  return CATALOG.map(({ source: _source, ...rest }) => rest);
}

/** Dropdown group for datasets the user added on the Datasets page. */
export const CUSTOM_GROUP = "Added by you";

// Datasets the user added (loaded from /api/datasets in the browser — see lib/datasets/client.ts).
let customDatasets: PublicDataset[] = [];

export function setCustomDatasets(list: PublicDataset[]) {
  customDatasets = list;
}

/** Every dataset that can be charted: the built-in catalog plus the user's own. */
export function allDatasets(): PublicDataset[] {
  return [...publicCatalog(), ...customDatasets];
}

export function getDataset(id: string): PublicDataset | undefined {
  return CATALOG.find((d) => d.id === id) ?? customDatasets.find((d) => d.id === id);
}

/** The rule actually used to compute quarterly values from monthly ones. */
export function computedQuarterlyRule(def: Pick<DatasetDef, "quarterly" | "quarterlyFallback">) {
  return def.quarterly === "official" ? (def.quarterlyFallback ?? "average") : def.quarterly;
}
