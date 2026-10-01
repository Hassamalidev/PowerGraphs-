import { unzipSync, strFromU8 } from "fflate";
import { parseDatasetFile, parseEitsResponse, type DatasetFile, type EitsRow } from "./parse";

// Server-only: this module reads CENSUS_API_KEY. Never import it from client code.

const API_BASE = "https://api.census.gov/data/timeseries/eits";
const FILE_BASE = "https://www.census.gov/econ_getzippedfile/";
const TIMEOUT_MS = 10_000;
const API_COLUMNS = "cell_value,data_type_code,category_code,seasonally_adj,error_data,time_slot_id,geo_level_code";

export type ProgramData = {
  rows: EitsRow[];
  via: "api" | "file";
  /** When Census last updated the data (YYYY-MM-DD), when the source says so. */
  updatedOn: string | null;
};

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

/** Try once more on failure; Census occasionally drops a request. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

/** Census EITS API. Needs CENSUS_API_KEY — keyless requests are rejected. */
export async function fetchProgramFromApi(program: string, apiKey: string, fromYear = 1963): Promise<ProgramData> {
  const url = `${API_BASE}/${program}?get=${API_COLUMNS}&for=us:*&time=from+${fromYear}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`Census API returned ${res.status}`);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // A missing or invalid key comes back as an HTML page with status 200.
    throw new Error("Census API did not return JSON (is CENSUS_API_KEY valid?)");
  }
  return { rows: parseEitsResponse(json), via: "api", updatedOn: null };
}

/** Download and unzip the "Download Data Sets" file for a program. No key needed. */
export async function fetchProgramFile(program: string): Promise<DatasetFile> {
  const res = await fetchWithTimeout(`${FILE_BASE}?programCode=${program.toUpperCase()}`);
  if (!res.ok) throw new Error(`Census data file returned ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!name) throw new Error("Census data file did not contain a CSV.");
  return parseDatasetFile(strFromU8(files[name]));
}

/**
 * All rows for one Census program. Uses the API when a key is configured and
 * falls back to the downloadable data file (the same data) otherwise.
 */
export async function fetchProgram(program: string): Promise<ProgramData> {
  const apiKey = process.env.CENSUS_API_KEY;
  if (apiKey) {
    try {
      return await withRetry(() => fetchProgramFromApi(program, apiKey));
    } catch (err) {
      console.warn(`[census] API failed, trying the data file: ${(err as Error).message}`);
    }
  }
  const file = await withRetry(() => fetchProgramFile(program));
  return { rows: file.rows, via: "file", updatedOn: file.updatedOn };
}
