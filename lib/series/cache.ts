import { z } from "zod";
import { prisma } from "@/lib/db";
import { fetchProgram } from "@/lib/census/client";
import { rowsToPoints, type MonthlyPoint } from "@/lib/census/parse";
import { CATALOG, type DatasetDef } from "@/lib/datasets/catalog";
import { seedSeries } from "./seed";

const MAX_AGE_MS = 12 * 60 * 60 * 1000; // refresh from Census at most every 12 hours
const RETRY_AFTER_FAILURE_MS = 5 * 60 * 1000; // don't hammer Census while it's down

const payloadSchema = z.object({
  points: z.array(z.object({ date: z.string(), value: z.number() })),
  dataUpdatedOn: z.string().nullable(),
});

export type MonthlySeries = {
  points: MonthlyPoint[];
  /** ISO date the data is "as of": Census's own update date when known, else when we fetched it. */
  dataAsOf: string;
  /** True when Census couldn't be reached and a saved copy is being shown. */
  isFallback: boolean;
  fallbackDate?: string;
};

type CacheRow = { points: MonthlyPoint[]; dataUpdatedOn: string | null; fetchedAt: Date };

const refreshing = new Map<string, Promise<void>>();
const lastFailure = new Map<string, number>();

async function readCache(seriesId: string): Promise<CacheRow | null> {
  try {
    const row = await prisma.seriesCache.findUnique({ where: { seriesId } });
    if (!row) return null;
    const parsed = payloadSchema.safeParse(JSON.parse(row.payload));
    if (!parsed.success) return null;
    return { ...parsed.data, fetchedAt: row.fetchedAt };
  } catch (err) {
    console.warn(`[series] could not read the cache: ${(err as Error).message}`);
    return null;
  }
}

/** Fetch a whole program once and replace every cached series that belongs to it. */
async function refreshProgram(program: string): Promise<void> {
  const data = await fetchProgram(program);
  const fetchedAt = new Date();
  const writes = [];
  for (const def of CATALOG.filter((d) => d.source.program === program)) {
    const points = rowsToPoints(data.rows, def.source, def.scale);
    if (points.length === 0) continue;
    const payload = JSON.stringify({ points, dataUpdatedOn: data.updatedOn });
    // Recent months get revised, so the whole series is replaced, never appended.
    writes.push(
      prisma.seriesCache.upsert({
        where: { seriesId: def.id },
        create: { seriesId: def.id, payload, fetchedAt },
        update: { payload, fetchedAt },
      }),
    );
  }
  await prisma.$transaction(writes);
}

function refreshOnce(program: string): Promise<void> {
  let job = refreshing.get(program);
  if (!job) {
    job = refreshProgram(program)
      .then(() => {
        lastFailure.delete(program);
      })
      .catch((err) => {
        lastFailure.set(program, Date.now());
        throw err;
      })
      .finally(() => refreshing.delete(program));
    refreshing.set(program, job);
  }
  return job;
}

function fromCache(row: CacheRow, isFallback: boolean): MonthlySeries {
  return {
    points: row.points,
    dataAsOf: row.dataUpdatedOn ?? row.fetchedAt.toISOString(),
    isFallback,
    fallbackDate: isFallback ? row.fetchedAt.toISOString() : undefined,
  };
}

/**
 * Monthly points for one dataset: fresh cache → Census → stale cache → seed.
 * Returns null only if there is no data anywhere.
 */
export async function getMonthlySeries(def: DatasetDef): Promise<MonthlySeries | null> {
  const cached = await readCache(def.id);
  if (cached && Date.now() - cached.fetchedAt.getTime() < MAX_AGE_MS) return fromCache(cached, false);

  const program = def.source.program;
  const failedAt = lastFailure.get(program);
  if (!failedAt || Date.now() - failedAt > RETRY_AFTER_FAILURE_MS) {
    try {
      await refreshOnce(program);
      const fresh = await readCache(def.id);
      if (fresh) return fromCache(fresh, false);
    } catch (err) {
      console.warn(`[series] Census refresh failed: ${(err as Error).message}`);
    }
  }

  if (cached) return fromCache(cached, true);

  const seed = seedSeries(def.id);
  if (!seed) return null;
  return {
    points: seed.points,
    dataAsOf: seed.dataUpdatedOn ?? seed.savedAt,
    isFallback: true,
    fallbackDate: seed.savedAt,
  };
}
