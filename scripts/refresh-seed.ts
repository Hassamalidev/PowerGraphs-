// Downloads every catalog series and saves data/seed/ressales.json — the
// offline copy the app uses when there is no cache and Census can't be reached.
//
//   npm run seed
//
// Commit the result.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchProgram } from "@/lib/census/client";
import { rowsToPoints } from "@/lib/census/parse";
import { CATALOG } from "@/lib/datasets/catalog";
import type { SeedFile } from "@/lib/series/seed";

try {
  process.loadEnvFile();
} catch {
  // no .env file — fine
}

async function main() {
  const program = await fetchProgram("ressales");
  const savedAt = new Date().toISOString();
  const seed: SeedFile = {
    savedAt,
    dataUpdatedOn: program.updatedOn,
    via: program.via,
    series: {},
  };

  for (const def of CATALOG) {
    const points = rowsToPoints(program.rows, def.source, def.scale);
    if (points.length === 0) throw new Error(`No data found for catalog series "${def.id}". Check its codes.`);
    seed.series[def.id] = points.map((p) => [p.date, p.value]);
    console.log(`${def.id.padEnd(28)} ${String(points.length).padStart(4)} points  ${points[0].date} → ${points[points.length - 1].date}`);
  }

  const dest = path.join(process.cwd(), "data", "seed", "ressales.json");
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(seed) + "\n", "utf8");
  console.log(`\nSaved ${dest} (source: ${program.via}, data updated ${program.updatedOn ?? "unknown"})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
