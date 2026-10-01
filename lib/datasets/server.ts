import type { CustomDataset } from "@prisma/client";
import { fetchProgramFile } from "@/lib/census/client";
import type { DatasetFile } from "@/lib/census/parse";
import { prisma } from "@/lib/db";
import { CATALOG, CUSTOM_GROUP, publicCatalog, type DatasetDef, type PublicDataset, type QuarterlyRule, type Unit } from "./catalog";

// Server-side view of the datasets: the built-in catalog plus the ones the
// user added on the Datasets page (stored in the CustomDataset table).

const SOURCE_LABEL = "U.S. Census Bureau, New Residential Sales";

function toDef(row: CustomDataset): DatasetDef {
  const adjusted = row.seasonally_adj === "yes";
  return {
    id: row.id,
    name: row.name,
    shortName: row.name.length > 34 ? `${row.name.slice(0, 33).trimEnd()}…` : row.name,
    description: row.description,
    helpText: `Census calls this: ${row.description}. ${
      adjusted
        ? "Adjusted for normal seasonal ups and downs, so months can be compared fairly."
        : "Not adjusted for seasons, so some months are normally higher than others."
    }`,
    group: CUSTOM_GROUP,
    source: {
      provider: "census-eits",
      program: "ressales",
      category_code: row.category_code,
      data_type_code: row.data_type_code,
      seasonally_adj: adjusted ? "yes" : "no",
      geo_level_code: row.geo_level_code,
    },
    unit: row.unit as Unit,
    unitLabel: row.unitLabel,
    scale: row.scale,
    frequency: "monthly",
    quarterly: row.quarterly as QuarterlyRule,
    sourceLabel: SOURCE_LABEL,
  };
}

/** Datasets the user added. An unreachable database just means "none". */
export async function customDefs(): Promise<DatasetDef[]> {
  try {
    const rows = await prisma.customDataset.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDef);
  } catch (err) {
    console.warn(`[datasets] could not read the added datasets: ${(err as Error).message}`);
    return [];
  }
}

export async function allDefs(): Promise<DatasetDef[]> {
  return [...CATALOG, ...(await customDefs())];
}

export async function findDef(id: string): Promise<DatasetDef | undefined> {
  return CATALOG.find((d) => d.id === id) ?? (await customDefs()).find((d) => d.id === id);
}

/** Everything the browser may know about the datasets (no Census codes). */
export async function publicDatasets(): Promise<PublicDataset[]> {
  const custom = (await customDefs()).map(({ source: _source, ...rest }) => ({ ...rest, custom: true }));
  return [...publicCatalog(), ...custom];
}

// The Census file is the same for everyone and changes monthly; keep it for a few minutes.
let fileCache: { at: number; file: DatasetFile } | null = null;
const FILE_TTL_MS = 10 * 60 * 1000;

export async function censusFile(): Promise<DatasetFile> {
  if (fileCache && Date.now() - fileCache.at < FILE_TTL_MS) return fileCache.file;
  const file = await fetchProgramFile("ressales");
  fileCache = { at: Date.now(), file };
  return file;
}
