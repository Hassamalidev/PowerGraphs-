import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for the SeriesCache table.
const rows = new Map<string, { seriesId: string; payload: string; fetchedAt: Date }>();
const fetchProgram = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    seriesCache: {
      findUnique: async ({ where }: { where: { seriesId: string } }) => rows.get(where.seriesId) ?? null,
      upsert: async ({ where, create }: { where: { seriesId: string }; create: { seriesId: string; payload: string; fetchedAt: Date } }) => {
        rows.set(where.seriesId, create);
        return create;
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

vi.mock("@/lib/census/client", () => ({ fetchProgram: (...args: unknown[]) => fetchProgram(...args) }));

const HOURS = 60 * 60 * 1000;

function censusRows(value: string) {
  return [
    { cell_value: value, data_type_code: "TOTAL", category_code: "ASOLD", seasonally_adj: "yes", error_data: "no", geo_level_code: "US", time: "2026-08" },
  ];
}

async function load() {
  // Fresh module each time so the "recent failure" memory doesn't leak between tests.
  vi.resetModules();
  const { getMonthlySeries } = await import("@/lib/series/cache");
  const { getDataset } = await import("@/lib/datasets/catalog");
  return () => getMonthlySeries(getDataset("new_homes_sold_rate")!);
}

describe("getMonthlySeries", () => {
  beforeEach(() => {
    rows.clear();
    fetchProgram.mockReset();
  });

  it("fetches from Census and caches the result", async () => {
    fetchProgram.mockResolvedValue({ rows: censusRows("684"), via: "file", updatedOn: "2026-09-24" });
    const get = await load();
    const series = (await get())!;
    expect(series.points).toEqual([{ date: "2026-08", value: 684000 }]);
    expect(series.isFallback).toBe(false);
    expect(series.dataAsOf).toBe("2026-09-24");
    expect(rows.has("new_homes_sold_rate")).toBe(true);

    await get(); // second call is served from the cache
    expect(fetchProgram).toHaveBeenCalledTimes(1);
  });

  it("refreshes a cache older than 12 hours, replacing the whole series", async () => {
    rows.set("new_homes_sold_rate", {
      seriesId: "new_homes_sold_rate",
      payload: JSON.stringify({ points: [{ date: "2026-07", value: 1 }, { date: "2026-08", value: 2 }], dataUpdatedOn: "2026-08-25" }),
      fetchedAt: new Date(Date.now() - 13 * HOURS),
    });
    fetchProgram.mockResolvedValue({ rows: censusRows("684"), via: "file", updatedOn: "2026-09-24" });
    const series = (await (await load())())!;
    expect(series.points).toEqual([{ date: "2026-08", value: 684000 }]);
    expect(series.isFallback).toBe(false);
  });

  it("serves the saved copy, flagged as a fallback, when Census can't be reached", async () => {
    const fetchedAt = new Date(Date.now() - 30 * HOURS);
    rows.set("new_homes_sold_rate", {
      seriesId: "new_homes_sold_rate",
      payload: JSON.stringify({ points: [{ date: "2026-08", value: 672000 }], dataUpdatedOn: "2026-08-25" }),
      fetchedAt,
    });
    fetchProgram.mockRejectedValue(new Error("timeout"));
    const get = await load();
    const series = (await get())!;
    expect(series.points).toEqual([{ date: "2026-08", value: 672000 }]);
    expect(series.isFallback).toBe(true);
    expect(series.fallbackDate).toBe(fetchedAt.toISOString());

    await get(); // doesn't hammer Census right after a failure
    expect(fetchProgram).toHaveBeenCalledTimes(1);
  });

  it("falls back to the committed seed when there is no cache and no Census", async () => {
    fetchProgram.mockRejectedValue(new Error("offline"));
    const series = (await (await load())())!;
    expect(series.isFallback).toBe(true);
    expect(series.points.length).toBeGreaterThan(700);
    expect(series.points[0].date).toBe("1963-01");
    expect(series.fallbackDate).toBeTruthy();
  });
});
