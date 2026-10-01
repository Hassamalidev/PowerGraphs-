import type { MonthlyPoint } from "@/lib/census/parse";
import seedJson from "@/data/seed/ressales.json";

export type SeedFile = {
  savedAt: string; // ISO timestamp of when the snapshot was taken
  dataUpdatedOn: string | null; // YYYY-MM-DD, when Census last updated the data
  via: "api" | "file";
  series: Record<string, [string, number][]>;
};

const seed = seedJson as unknown as SeedFile;

export function seedSeries(id: string): { points: MonthlyPoint[]; savedAt: string; dataUpdatedOn: string | null } | null {
  const raw = seed.series[id];
  if (!raw || raw.length === 0) return null;
  return {
    points: raw.map(([date, value]) => ({ date, value })),
    savedAt: seed.savedAt,
    dataUpdatedOn: seed.dataUpdatedOn,
  };
}
